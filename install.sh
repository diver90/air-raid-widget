#!/bin/bash

EXTENSION_UUID="air-raid-widget@unibot.top"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

mkdir -p "$EXTENSION_DIR"
cp -r ./* "$EXTENSION_DIR"

glib-compile-schemas "$EXTENSION_DIR/schemas"

gnome-extensions enable $EXTENSION_UUID
