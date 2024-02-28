#!/usr/bin/env sh

./node_modules/.bin/jsdoc2md -t ../docs/lib_template.hbs src/* > ../docs/lib.md
