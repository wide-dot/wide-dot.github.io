# Scrolling software en asm 6809

En combinant plusieurs techniques de programmation, on peut réaliser un scrolling performant et 100% logiciel pour le processeur 6809.


Le signal vidéo est transmis de manière progressive en effectuant une lecture de la RAM vidéo durant le cycle inactif du 6809. Par conséquent, le seul moyen de faire défiler l'écran est de modifier le contenu de cette RAM.

(EXPLICATIONS/DIAGRAMMES)

La stratégie la plus évidente est la recopie des données en les déplaçant (lecture/écriture en RAM vidéo), mais c'est **extrement lent**.

(DONNER DES EXEMPLES et METRIQUES)

## Step 1: Stack Blast

> Un moyen bien connu pour produire des graphismes rapides est celui des sprites compilés. Avec le processeur 6809, les sprites compilés sont très rapides s'ils sont combinés avec la technique du stack blast.

Le Stack Blast consiste à utiliser les instruction PULx/PSHx pour effectuer des lectures et écritures rapides en mémoire. Dans notre cas nous allons utiliser l'instruction PSHS pour écrire rapidement en mémoire vidéo. Le coût est de 5 cycles pour l'instruction plus 1 cycle pour chaque octet écrit.
L'avantage de cette instruction est que le registre S qui stocke l'adresse de destination est mis à jour automatiquement en fonction du nombre d'octets écrits. On peut donc enchainer plusieurs PSHS sans avoir besoin de se soucier de la mise à jour de l'adresse de destination de la prochaine instruction d'écriture.

Les registres D,X,Y,U vont nous permettre de stocker les données “pixels”. Ces données sont chargées dans les registres en mode immédiat, c'est le principe des sprites compilés.

***Un “scroll-chunk”:***
```
Opcode/post-bytes | ASM Code                             | Cycles
----------------- | ------------------------------------ | ---------
CC xx xx          | LDD #$[xx xx : pixels data 16 bits]  | 3 cycles
8E xx xx          | LDX #$[xx xx : pixels data 16 bits]  | 3 cycles
10 8E xx xx       | LDY #$[xx xx : pixels data 16 bits]  | 4 cycles
CE xx xx          | LDU #$[xx xx : pixels data 16 bits]  | 3 cycles
34 76             | PSHS U,Y,X,D                         | 13 cycles
```

Sur un Thomson en mode BM16, en plaçant le registre S en fin de RAM vidéo, on peut ainsi peupler l’ensemble des données d'un écran 160x200 au moyen de seulement 2000 scroll-chunk comme celui ci dessus (8000 octets en Ram A et 8000 octets en Ram B) pour un total de 52000 cycles.

**Attention:**
En utilisant le registre S, on détourne le pointeur sur la pile système. Un déclenchement d'IRQ va donc écrire 12 octets en S (sauvegarde des registres processeur), il faut donc prévoir qu'un débordement se produira donc en dehors de la zone utile de la RAM vidéo.
En pratique sur un TO8, il faudra préserver les zones mémoire : 9FF4-9FFF et BFF4-BFFF qui se situent en amont des RAMA et RAM B (l'écriture par PSHS se fait en remontant). Il est recommandé dans une IRQ utilisateur de repositionner la pile système S de manière à limiter ce débordement à 12 octets.

## Step 2: Loop unrolling

> On pourrait imaginer utiliser des scroll-chunks comme éléments de tuile pour un système de tilemap, mais le code de contrôle serait trop consommateur de cycles. Afin de réduire au strict minimum le temps d'exécution de l'ensemble des scroll-chunk nécessaires au rafraichissement complet de la RAM vidéo, il faut dérouler le code (loop unrolling).

En déroulant l'ensemble du code nécessaire à la mise à jour de la RAMA et de la RAMB à l'aide des scroll-chunks on obtient deux routines ayant la structure suivante:

***Routine scrollA:***

    _vscroll.buffer.chunk MACRO
            ldd   #0
            ldx   #0
            ldy   #0
            ldu   #0
            pshs  d,x,y,u
     ENDM
    
    _vscroll.buffer.line MACRO
            _vscroll.buffer.chunk
            _vscroll.buffer.chunk
            _vscroll.buffer.chunk
            _vscroll.buffer.chunk
            _vscroll.buffer.chunk
     ENDM
    
    _vscroll.buffer.linex8 MACRO
            _vscroll.buffer.line
            _vscroll.buffer.line
            _vscroll.buffer.line
            _vscroll.buffer.line
            _vscroll.buffer.line
            _vscroll.buffer.line
            _vscroll.buffer.line
            _vscroll.buffer.line
     ENDM

    scrollA     
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            _vscroll.buffer.linex8
            jmp   returnFromScrollA

Chacune des deux routines occupe 15 * 5 * 8 * 25 octets soit 15000 octets pour les scroll-chunks. Il faudra donc consacrer quasiment deux pages de RAM à la routine d'affichage du scroll.

Dans cet exemple les données sont initialisées à 0. Il faudra bien entendu valoriser la valeur de chaque pixel dans les LDx durant la phase d'exécution du programme. On peut aussi initialiser les données à l'aide d'outils de conversion d'une image en code.

A cette étape il n'y a toujours pas de scroll, le code ne fait qu'écrire inlassablement les mêmes données en RAM vidéo à chaque tour de la boucle principale du programme.

Je ne détaille pas ici les mécanismes de double buffering pour ne pas rendre l'article trop complexe. Cependant le double buffering est nécessaire pour obtenir un affichage fluide et sans tearing. A ce stade des explications, l'usage de la RAM est donc le suivant :
- 2 pages de 16Ko de RAM vidéo A/B sont utilisées pour le double buffering 
- 2 pages de 16Ko de RAM sont utilisées pour les routines de scroll

## Step 3: Self-modifying code

> L'assembleur nous permet des libertés de programmation comme l'auto modification de code. cela consiste à remplacer des instructions ou des données lors de l'exécution du programme. 

Pour faire varier l'affichage et réaliser un scroll vertical on peut appeller la routine contenant les scroll-chunks en des points d'entrée différents à chaque tour de boucle principale. En avançant ou en reculant l'appel de 75 octets on fera varier l'écriture des données en mémoire vidéo d'une ligne. En utilisant cette méthode le scrolling ira à la vitesse de 1000000/52000 = 19,23 fps (si on fait abstraction du code nécessaire pour le double buffering et les quelques cycles nécessaire à la boucle principale et a la variabilisation de l'appel).

Si variabiliser le point d'entrée de la routine reste relativement simple, il faut gérer deux aspects pour que cela fonctionne :
- La routine d'affichage doit boucler sur elle-même
- Il faut modifier dynamiquement le code pour gérer le retour une fois les 200 lignes de pixels écrites.

***... a continuer***

## Step 4: Tiles and Tilemap

> Maintenant que le scroll est opérationnel il suffit d'implémenter un système de tilemap classique pour mettre à jour les données des scroll-chunks. Cela n'est nécessaire que pour les nouvelles lignes affichées évidement, ce qui réduit la mise à jour a effectuer à chaque frame à quelques octets. Là encore on utilise l'automodification de code.


***... a continuer***

## Step 5: Frame Drop conpensation

> Pour obtenir un défilé stable, au travers d'une irq à 50Hz, on compte le nombre de frame drop avéré et on compense ainsi le nombre de lignes à scroller.

***... a continuer***

## Conclusion

Ce scrolling a été implémenté dans notre moteur de jeux dans sa version verticale. Il est tout à fait possible de faire une version multidirectionnelle ... un jour peut-être !