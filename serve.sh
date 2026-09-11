#!/bin/sh
# Serve the site locally with the Homebrew Ruby (4.x): the github-pages gem pins Jekyll
# 3.9 and Liquid 4.0, which need the taint shim of _plugins/ruby4-compat.rb, the standard
# gems declared in the Gemfile, and a UTF-8 locale for the theme's Sass.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/lib/ruby/gems/4.0.0/bin:$PATH"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export RUBYOPT="-r$PWD/_plugins/ruby4-compat.rb"
exec bundle exec jekyll serve --livereload "$@"
