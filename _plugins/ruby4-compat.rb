# Local builds only (GitHub Pages runs in safe mode and ignores _plugins): Liquid 4.0,
# pinned by the github-pages gem, still calls the taint methods that Ruby 3.2 removed.
class Object
  def tainted?; false; end unless method_defined?(:tainted?)
  def taint; self; end unless method_defined?(:taint)
  def untaint; self; end unless method_defined?(:untaint)
end
