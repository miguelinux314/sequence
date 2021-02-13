#!/bin/bash

# electron-packager <sourcedir> <appname> --platform=<platform> --arch=<arch> [optional flags...]

electron-packager ./ sequence-game --platform=linux
electron-packager ./ sequence-game --platform=win32
