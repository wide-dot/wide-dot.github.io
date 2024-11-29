---
layout: default
title:  Scrolling Software en asm 6809
date:   2024-11-29
categories: article
banner: /images/articles/scroll/banner.png
display-instructions: false
---

## Introduction

Sur un Thomson MO/TO, le signal vidéo est transmis de manière progressive par un automate hardware qui effecte une lecture de la RAM vidéo durant le cycle inactif du 6809. Par conséquent, le seul moyen de faire défiler l'écran est de modifier le contenu de cette RAM. 

Il n'y a pas possibilité de faire varier le point de départ de la lecture effectuée par l'automate : c'est dommage car cela aurait permis d'effectuer un scrolling hardware comme cela peut exister sur d'autres machines telles que le commodore 64, les Amstrad CPC, l'Amiga, l'Atari ST pour lesquelles il suffit de modifier un registre mémoire pour décaler l'affichage.

En combinant plusieurs techniques de programmation, on peut cependant réaliser un scrolling performant et **100% software** par le processeur 6809.

## Etape 1 : Stack Blast

Un moyen bien connu pour produire des graphismes rapides est celui des **sprites compilés**. Avec le processeur 6809, les sprites compilés sont très rapides s'ils sont combinés avec la technique du **stack blast**.

Le Stack Blast consiste à utiliser les instruction PULx/PSHx pour effectuer des lectures et écritures rapides en mémoire. Dans notre cas nous allons utiliser l'instruction PSHS pour écrire rapidement en mémoire vidéo. Le coût est seulement de 5 cycles pour l'instruction plus 1 cycle pour chaque octet écrit. Dans notre cas, il s'agira d'écrire 8 octets à chaque fois, soit 13 cycles consommés (5 + 8).

L'avantage de cette instruction est que le registre S qui stocke l'adresse de destination est mis à jour automatiquement en fonction du nombre d'octets écrits. On peut donc enchainer plusieurs PSHS sans avoir besoin de se soucier de la mise à jour de l'adresse de destination pour la prochaine instruction d'écriture.

Les registres D,X,Y,U vont nous permettre de stocker les données “pixels”. Ces données sont chargées dans les registres en mode immédiat, c'est le principe des sprites compilés.

***Un “scroll-chunk”:***

Opcode/post-bytes   | ASM Code                                | Cycles
------------------- | --------------------------------------- | ---------
`CC xx xx`          | `ldd   #$[xx xx : pixels data 16 bits]` | 3 cycles
`8E xx xx`          | `ldx   #$[xx xx : pixels data 16 bits]` | 3 cycles
`10 8E xx xx`       | `ldy   #$[xx xx : pixels data 16 bits]` | 4 cycles
`CE xx xx`          | `ldu   #$[xx xx : pixels data 16 bits]` | 3 cycles
`34 76`             | `pshs  u,y,x,d`                         | 13 cycles

> Notez que LDY consomme 1 cycle de plus que les autres instructions de chargement de registre. 

Un scroll chunk, qui représente alors 64 bits utiles, c'est à dire 16 pixels, occupe dont 15 octets en mémoires, c'est à 120 bits. 

**Sur un Thomson TO8 en mode BM16, en plaçant le registre S en fin de RAM vidéo, on peut ainsi peupler l’ensemble des données d'un écran 160x200 au moyen de seulement 2000 scroll-chunk comme celui ci dessus (8000 octets en Ram A et 8000 octets en Ram B) pour un total de 16000 octets et l'usage de 52000 cycles.**

**Attention:**
En utilisant le registre S on détourne l'usage du pointeur de la pile système, or chaque déclenchement d'IRQ écrit 12 octets en S (sauvegarde des registres processeur) à n'importe quel moment du programme. Lorsque la routine d'écriture ci dessus aura positionné S en limite de RAM vidéo un débordement pourra donc se produire en dehors de la zone utile de la RAM vidéo.
En pratique sur un TO8, il faudra préserver les zones mémoire : `9FF4-9FFF` et `BFF4-BFFF` qui se situent en amont des RAMA et RAM B (l'écriture par PSH se fait en remontant). Il est recommandé dans une IRQ utilisateur de repositionner la pile système S vers un espace tampon de manière à limiter ce débordement à 12 octets.

## Etape 2: Loop unrolling

> On pourrait imaginer utiliser des scroll-chunks comme éléments de tuile pour un système de tilemap, mais le code de contrôle serait trop consommateur de cycles. Afin de réduire au strict minimum le temps d'exécution de l'ensemble des scroll-chunk nécessaires au rafraichissement complet de la RAM vidéo, il faut dérouler le code (loop unrolling).

En déroulant l'ensemble du code nécessaire à la mise à jour de la RAMA et de la RAMB à l'aide des scroll-chunks on obtient deux routines ayant la structure suivante:

**Routine scrollA :**
```
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
```

Chacune des deux routines occupe 15 * 5 * 8 * 25 octets soit 15000 octets pour les scroll-chunks. Il faudra donc consacrer quasiment deux pages de RAM à la routine d'affichage du scroll.

Dans cet exemple les données sont initialisées à 0. Il faudra bien entendu valoriser la valeur de chaque pixel dans les LDx durant la phase d'exécution du programme. On peut aussi initialiser les données à l'aide d'outils de conversion d'une image en code.

A cette étape il n'y a toujours pas de scroll, le code ne fait qu'écrire inlassablement les mêmes données en RAM vidéo à chaque tour de la boucle principale du programme.

> Je ne détaille pas ici les mécanismes de double buffering pour ne pas rendre l'article trop complexe. Cependant le double buffering est nécessaire pour obtenir un affichage fluide et sans tearing. 

A ce stade des explications, l'usage de la RAM est donc le suivant :
- 2 pages de 16Ko de RAM vidéo A/B sont utilisées pour le double buffering 
- 2 pages de 16Ko de RAM sont utilisées pour les routines de scroll

## Step 3: Self-modifying code

> L'assembleur nous permet des libertés de programmation comme l'auto modification de code. cela consiste à remplacer des instructions ou des données lors de l'exécution du programme. 

Pour faire varier l'affichage et réaliser un scroll vertical on peut appeller la routine contenant les scroll-chunks en des points d'entrée différents à chaque tour de boucle principale. En avançant ou en reculant l'appel de 75 octets on fera varier l'écriture des données en mémoire vidéo d'une ligne. En utilisant cette méthode le scrolling ira à la vitesse de 1000000/52000 = 19,23 fps (si on fait abstraction du code nécessaire pour le double buffering et les quelques cycles nécessaire à la boucle principale et a la variabilisation de l'appel).

Si variabiliser le point d'entrée de la routine reste relativement simple, il faut gérer deux autres aspects pour que cela fonctionne :
- La routine d'affichage doit boucler sur elle-même
- Il faut modifier dynamiquement le code pour gérer le retour une fois les 200 lignes de pixels écrites.

Le point de sortie est appliqué dynamiquement dans les 2 routines par modification d’OPCODE, juste après l’un des PSHS qui termine la ligne de scroll. Il s’agit d’écrire une instruction JMP qui permet le retour vers l’algorithme qui pilote le scroll, cette adresse retour étant fixe et connue. Avant de modifier le code on effectue donc une sauvegarde du code écrasé pour pouvoir le repositionner par la suite.

```
 Opcode/post-bytes        ASM Code       
 -----------------        -------------  

                          @loop

 ...                                                    ; some scroll-chunks

 CC 00 00                 ldd   #$0000                  ; last scroll-chunck
 8E 00 00                 ldx   #$0000    
 10 8E 00 00              ldy   #$0000    
 CE 00 00                 ldu   #$0000    
 34 76                    pshs  u,y,x,d   

(CC 00 00) -> 7E 77 77   (ldd   #$0000) -> jmp   #$7777 ; return to caller without using S
 8E 00 00                 ldx   #$0000                  ; unusable scroll-chunck
 10 8E 00 00              ldy   #$0000                  ; ...
 CE 00 00                 ldu   #$0000                  ; ...
 34 76                    pshs  u,y,x,d                 ; ...

 ...                                                    ; 4x unusable scroll-chunck (whole pixel line)

 CC 00 00                 ldd   #$0000                  ; first scroll-chunck (routine entry)
 8E 00 00                 ldx   #$0000    
 10 8E 00 00              ldy   #$0000    
 CE 00 00                 ldu   #$0000    
 34 76                    pshs  u,y,x,d  

...                                                    ; some scroll-chunck

 7E 00 00                 jmp   @loop

```

Ce mécanisme de gestion du retour de la routine vient "obturer" un scroll-chunk de manière temporaire, ce qui rend inopérant l'utilisation de la ligne entière. En conséquence un ensemble de 5 scroll-chunk suppémentaires (une ligne de pixels) doivent être ajouté aux deux routines.

**Routine de scroll finale :**
```
@loop   _vscroll.buffer.linex8
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
        _vscroll.buffer.line
        jmp   @loop
```            

La mise en oeuvre de ces routines de scroll est pilotée par le code suivant :

```
; -----------------------------------------------------------------------------
; vscroll.do
; -----------------------------------------------------------------------------
; input  REG : none
; -----------------------------------------------------------------------------
; S register is used to write in video buffer, you should expect irq calls
; to write 12 bytes into or just before video memory.
; If it occurs at the end of the buffer routine, before S is retored,
; it will erase bytes at $9FF4-$9FFF and $BFF4-$BFFF, so leave this aera unsed.
; -----------------------------------------------------------------------------
vscroll.do
        lda   vscroll.obj.bufferB.page
        ldx   vscroll.obj.bufferB.address
@loop   _SetCartPageA                  ; mount page that contain buffer code
        ldb   vscroll.cursor           ; screen start line (0-199)
        addb  vscroll.viewport.height  ; viewport size (1-200)
        bcs   @cycle
        cmpb  #vscroll.BUFFER_LINES
        bls   >
@cycle  subb  #vscroll.BUFFER_LINES    ; cycling in buffer
!       lda   #vscroll.LINE_SIZE
        mul
        leau  d,x                      ; set u where a jump should be placed for return to caller
        pulu  a,y                      ; save 3 bytes in buffer that will be erased by the jmp return
        stu   @save_u
        pshs  a,y
        lda   #m6809.OPCODE_JMP_E      ; build jmp instruction
        ldy   #@ret                    ; this works even at the end of table because there is 
        sta   -3,u                     ; already a jmp for looping into the buffer
        sty   -2,u                     ; no need to have some padding
        sts   @save_s
        lds   #$BF40
vscroll.viewport.ram equ *-2
        lda   vscroll.cursor
        ldb   #vscroll.LINE_SIZE
        mul
        leax  d,x                      ; set starting position in buffer code
        jmp   ,x
@ret    lds   #0
@save_s equ   *-2
        ldu   #0
@save_u equ   *-2
        puls  a,x
        pshu  a,x                      ; restore 3 bytes in buffer
        lda   vscroll.viewport.ram
        cmpa  #$C0
        bhs   >                        ; exit if second buffer code as been executed
        adda  #$20                     ; else execute second buffer code
        sta   vscroll.viewport.ram
        lda   vscroll.obj.bufferA.page
        ldx   vscroll.obj.bufferA.address
        bra   @loop
!       lda   vscroll.viewport.ram
        suba  #$20
        sta   vscroll.viewport.ram     ; restore to first buffer
        rts
```

## Step 4: Tiles and Tilemap

Maintenant que le scroll est opérationnel il suffit d'implémenter un système de tilemap classique pour mettre à jour les données des scroll-chunks.

Un des intérêts de l'algorithme de scroll présenté ici est que les données des pixels sont persistées directement dans le code des scroll-chunks. Lorsque le viewport se déplace, on a seulement besoin de mettre à jour les pixels apparaissant à l'écran, ceux déjà présents dans les scroll-chunks ne bougent pas.

La mise à jour des données de pixel est effectuée par automodification de code dans la routine **vscroll.copyBitmap** du code ci dessous :

```
; update gfx in buffer code
; -------------------------
vscroll.updategfx
        jsr   vscroll.computeBufferWAddress
        tst   <vscroll.loop.counter
        lbeq  @exit                          ; when viewport shrink nothing to render
        ldx   vscroll.obj.bufferA.address
        leax  d,x
        stx   <vscroll.buffer.wAddressA
        ldx   vscroll.obj.bufferB.address
        leax  d,x
        stx   <vscroll.buffer.wAddressB
        ; compute current line in tile
        ldb   map.CF74021.DATA
        stb   <vscroll.backBuffer            ; backup back video buffer
        lda   vscroll.camera.lastY+1         ; LSB only
        adda  <vscroll.skippedLines          ; nb skip lines (outside viewport)
        ldb   vscroll.speed
        bpl   >
        deca                                 ; next line in tile
        ldb   #$4A ; deca
        ldu   #0
        ldx   #0
        ldy   #-1
        bra   @mod
!       adda  vscroll.viewport.height
        inca                                 ; previous line in tile
        ldb   #$4C ; inca
        ldu   vscroll.viewport.height.w
        ldx   #-vscroll.LINE_SIZE*2
        ldy   #1
@mod
        anda  #$0f                           ; modulo to keep 0-15      
        sta   <vscroll.tileset.line
        ; setup dynamic code in main scroll loop
        sty   @direction
        stb   @direction2
        stu   @direction3
        stx   @direction4
        stx   @direction5
        ldd   vscroll.camera.lastY
        addd  #0                             ; add viewport when going down
@direction3 equ *-2
@loop   
        addd  #0
@direction equ *-2
        cmpd  vscroll.map.height
        bge   >
        tsta
        bpl   @end1
        addd  vscroll.map.height
        bra   @end1
!       subd  vscroll.map.height
@end1   std   <vscroll.camera.currentY
;
        jsr   vscroll.updateTileCache        ; check cache for this line number (in d)
        lda   vscroll.obj.bufferA.page
        _SetCartPageA                        ; mount in cartridge space
        lda   <vscroll.tileset.line
        lsla
        ldx   #vscroll.obj.tile.adresses     ; load A tileset addr
        ldy   a,x
        ldx   #vscroll.obj.tile.pages        ; load A tileset page
        lda   a,x
        sta   map.CF74021.DATA               ; mount in data space
        ldu   <vscroll.buffer.wAddressA
        jsr   vscroll.copyBitmap             ; copy bitmap for buffer A
        leau  -vscroll.LINE_SIZE*2,u
@direction4 equ *-2
        cmpu  vscroll.obj.bufferA.address
        bge   @tendA
        leau  vscroll.BUFFER_LINES*vscroll.LINE_SIZE,u
        bra   >
@tendA  cmpu  vscroll.obj.bufferA.end
        blt   >
        leau  -vscroll.BUFFER_LINES*vscroll.LINE_SIZE,u
!       stu   <vscroll.buffer.wAddressA
;
        lda   vscroll.obj.bufferB.page
        _SetCartPageA                        ; mount in cartridge space
        lda   <vscroll.tileset.line
        lsla
        ldx   #vscroll.obj.tile.adresses     ; load B tileset addr
        ldy   a,x
        inca                                 ; load B tileset page
        ldx   #vscroll.obj.tile.pages
        lda   a,x
        sta   map.CF74021.DATA               ; mount in data space
        ldu   <vscroll.buffer.wAddressB
        jsr   vscroll.copyBitmap             ; copy bitmap for buffer B
        leau  -vscroll.LINE_SIZE*2,u
@direction5 equ *-2
        cmpu  vscroll.obj.bufferB.address
        bge   @tendB
        leau  vscroll.BUFFER_LINES*vscroll.LINE_SIZE,u
        bra   >
@tendB  cmpu  vscroll.obj.bufferB.end
        blt   >
        leau  -vscroll.BUFFER_LINES*vscroll.LINE_SIZE,u
!       stu   <vscroll.buffer.wAddressB
;
        lda   <vscroll.tileset.line
        inca
@direction2 equ *-1
        anda  #$0f
        sta   <vscroll.tileset.line
;
        ldd   <vscroll.camera.currentY
        dec   <vscroll.loop.counter
        lbne  @loop
@exit
        ldb   vscroll.speed
        bpl   >
        ldb   #$ff
        bra   @end2
!       clrb
@end2   stb   vscroll.speed
        ldb   <vscroll.backBuffer            ; restore back video buffer
        stb   map.CF74021.DATA
        rts

; update the horizontal line of tile id in map cache
; --------------------------------------------------
vscroll.updateTileCache
        andb  #$f0                     ; tile height is 16px, faster check here than _asrd*4
        cmpd  vscroll.map.cache.y
        bne   >
        rts                            ; return, cache is already up to date
!       std   vscroll.map.cache.y      ; load cache at a new position
        lda   vscroll.obj.map.page
        _SetCartPageA                  ; mount page that contain map data
        ldx   vscroll.obj.map.address
        lda   vscroll.map.cache.y      ; handle up to 512 lines in map, b already loaded
        _lsrd                          ; divide
        _lsrd                          ; by
        _lsrd                          ; 16 to get
        _lsrd                          ; line number in map
        _lsrd                          ; divide line in map by two
        bcc   >                        ; branch if line in map is even
        leax  30,x                     ; if line in map is odd, offset position in map by 30 bytes (12bits id * 20 tiles)
!       lda   #60                      ; 2 lines of 30 bytes (12bits id * 20 tiles)
        mul                            ; mult by line/2
        leax  d,x                      ; x point to desired data map line
        ldy   #vscroll.map.cache
        lda   #20/2                    ; nb byte to load/2
        sta   <vscroll.loop.counter2
@loop   ldd   ,x+                      ; load cache by unpacking tile id
        _lsrd                          ; from 12bit to 16bit
        _lsrd
        _lsrd
        _lsrd
        std   ,y++
        ldd   ,x++
        anda  #$0F
        std   ,y++
        dec   <vscroll.loop.counter2
        bne   @loop
        rts

; copy the tile bitmap to the code buffer
; ---------------------------------------
vscroll.copyBitmap
        ldx   #vscroll.map.cache.end   ; read tiles in reverse order (from right to left)
@loop
        leax  -8,x                     ; move to next tile id in cache (to the left)
        ldd   6,x                      ; load tile id
        ldd   d,y                      ; load 4 pixels of this tile line
        std   11,u                     ; fill the LDU
        ldd   4,x                      ; load tile id
        ldd   d,y                      ; load 4 pixels of this tile line
        std   8,u                      ; fill the LDY
        ldd   2,x                      ; load tile id
        ldd   d,y                      ; load 4 pixels of this tile line
        std   4,u                      ; fill the LDX
        ldd   ,x                       ; load tile id
        ldd   d,y                      ; load 4 pixels of this tile line
        std   1,u                      ; fill the LDD
        leau  15,u                     ; move to next dest block in code buffer
        cmpx  #vscroll.map.cache
        bne   @loop
        rts

; compute write location in buffer
; --------------------------------
vscroll.computeBufferWAddress

        ; compute number of lines to render
        ldd   #0
        std   <vscroll.skippedLines        ; init tmp value
        ldb   vscroll.speed
        bpl   >
        comb                               ; by truncating, negative is floor and positive is ceil, so make it ceil also for negative
!       cmpb  vscroll.viewport.height      ; compare to viewport height
        bls   >
        subb  vscroll.viewport.height
        stb   <vscroll.skippedLines+1      ; number of skipped lines (outside of viewport)
        ldb   vscroll.viewport.height      ; keep lowest value
!       stb   <vscroll.loop.counter        ; setup nb of line to render

        ; compute relative write location in code buffer
        tst   vscroll.speed
        bmi   @goUp
@goDown
        addd  vscroll.cursor.w
        subd  #1
        subd  <vscroll.skippedLines        ; skip lines if needed
        bmi   @loop
        cmpd  #vscroll.BUFFER_LINES
        bhs   @loop2
        bra   >
@loop
        addd  #vscroll.BUFFER_LINES    ; cycling in buffer
        bmi   @loop
        bra   >
@goUp
        negb                           ; substract it to cursor + viewport height
        sex                            ; omg !
        addd  vscroll.cursor.w
        addd  vscroll.viewport.height.w
        addd  <vscroll.skippedLines
        cmpd  #vscroll.BUFFER_LINES
        blo   >
@loop2
        subd  #vscroll.BUFFER_LINES    ; cycling in buffer
        cmpd  #vscroll.BUFFER_LINES
        bhs   @loop2
!       lda   #vscroll.LINE_SIZE
        mul
        rts
```

## Step 5: Frame Drop conpensation

Pour obtenir un défilement stable, au travers d'une IRQ à 50Hz, on compte le nombre de frame drop avéré et on compense ainsi le nombre de lignes à scroller.

```
vscroll.move

; update position in map and buffer
; ---------------------------------

        ; check for elapsed frames
        lda   gfxlock.frameDrop.count
        bne   >
@exit   rts
;
        ; compute frame compensated speed
!       sta   <vscroll.loop.counter
        ldd   vscroll.speed                  ; load speed value of previous frame
!       addd  vscroll.camera.speed           ; mult speed by frame drop
        dec   <vscroll.loop.counter
        bne   <
;
        ; exit if speed is too small (subpixel)
        stb   vscroll.speed+1
        sta   vscroll.speed
        adda  #128 ; this cryptic code negate integer part of a 8.8 value
        eora  #127 ; and round by floor
        sbca  #255 ; cursor goes the opposite direction of y in buffer
        beq   @exit

        ; compute cursor in cycling buffer code (modulo)
        tfr   a,b
        sex
        bpl   @goUp
@goDown
        addd  vscroll.cursor.w
        bpl   @end
!       addd  #vscroll.BUFFER_LINES
        bmi   <
        bra   @end
@goUp
        addd  vscroll.cursor.w
        cmpd  #vscroll.BUFFER_LINES
        blo   @end
!       subd  #vscroll.BUFFER_LINES
        cmpd  #vscroll.BUFFER_LINES
        bhs   <
@end    stb   vscroll.cursor

        ; compute position in map
        ldx   vscroll.camera.y
        stx   vscroll.camera.lastY
        ldb   vscroll.speed                  ; get int part of 8.8
        bpl   >
        incb                                 ; by truncating, negative is floor and positive is ceil, so make it ceil also for negative
!       leax  b,x                            ; do not use abx, b is signed, speed is implicitly caped to a choppy 127px by frame

        ; wrap camera position in map (infinite level loop)
        tfr   x,d
        cmpx  vscroll.map.height
        bge   >
        tsta
        bpl   @end
        addd  vscroll.map.height
        bra   @end
!       subd  vscroll.map.height
@end    std   vscroll.camera.y
```

## Conclusion

En terme de rendu final, à ce stade, on obtient alors ceci :

{% include youtube.html youtube-id="yXLnh93cATU" %}

**Ce scrolling a été implémenté dans notre moteur de jeux dans sa version verticale pour [BattleSquadron](/battlesquadron.html) et [Goldorak](/goldorak.html). Il est tout à fait possible de faire une version multidirectionnelle ... un jour peut-être !**

## Annexe

Quelques compléments sur la structure des données ...

```
; -----------------------------------------------------------------------------
; Vertical Scroll
; -----------------------------------------------------------------------------
; wide-dot - Benoit Rousseau - 11/09/2023
; ---------------------------------------
; - use a cycling code buffer to render a vertical scroll
; - buffer use stack blasting (pshs d,x,y,u)
; - buffer is only updated few lines per frame (only the new lines)
; - scroll is bi-directionnal
; - speed is a fixed point value and adjusted in regard of frame drop
; - handle up to 512 lines of tiles in a map
; -----------------------------------------------------------------------------

        opt c

; constants
; -----------------------------------------------------------------------------
m6809.OPCODE_JMP_E          equ   $7E

vscroll.LINE_SIZE           equ   75
 IFNDEF  vscroll.BUFFER_LINES
vscroll.BUFFER_LINES        equ   201  ; nb lines in buffer is 201 (0-200 to fit JMP return)
 ENDC

; parameters
; -----------------------------------------------------------------------------
; scroll data is split in 5 pages
vscroll.obj.map.page        fcb   0
vscroll.obj.map.address     fdb   0
vscroll.obj.tile.pages      fill  0,32 ; pages for every line tileset A and B
vscroll.obj.tile.adresses   fill  0,32 ; starting position for every line tileset (generic)
vscroll.obj.tile.nbx2       fdb   0
vscroll.obj.bufferA.page    fcb   0
vscroll.obj.bufferA.address fdb   0
vscroll.obj.bufferA.end     fdb   0
vscroll.obj.bufferB.page    fcb   0
vscroll.obj.bufferB.address fdb   0
vscroll.obj.bufferB.end     fdb   0
vscroll.camera.speed        fdb   0    ; (signed 8.8 fixed point) nb of pixels/50hz

; private variables
; -----------------------------------------------------------------------------
vscroll.cursor.w            fcb   0    ; padding for 16 bit operations
vscroll.cursor              fcb   0
vscroll.speed               fdb   0    ; (signed 8.8 fixed point) nb of line to scroll
vscroll.map.height          fdb   0    ; map height in pixels
vscroll.map.cache.y         fdb   -1   ; current cached map line
vscroll.map.cache           fill  0,40 ; a full unpacked map line with 20x tile ids
vscroll.map.cache.end       equ   *
vscroll.viewport.height.w   fcb   0    ; padding for 16 bit operations
vscroll.viewport.height     fcb   0
vscroll.viewport.y          fcb   0    ; y position of viewport on screen
vscroll.camera.y            fdb   0    ; camera position in map
vscroll.camera.lastY        fdb   0    ; last camera position in map

; -----------------------------------------------------------------------------
; vscroll.move
; -----------------------------------------------------------------------------
; input  REG : none
; -----------------------------------------------------------------------------

; temporary variables in dp
vscroll.loop.counter        equ dp_extreg    ; BYTE
vscroll.loop.counter2       equ dp_extreg+1  ; BYTE
vscroll.backBuffer          equ dp_extreg+2  ; BYTE
vscroll.buffer.wAddressA    equ dp_extreg+3  ; WORD
vscroll.buffer.wAddressB    equ dp_extreg+5  ; WORD
vscroll.camera.currentY     equ dp_extreg+7  ; WORD
vscroll.skippedLines        equ dp_extreg+9  ; WORD
vscroll.tileset.line        equ dp_extreg+11 ; BYTE
```