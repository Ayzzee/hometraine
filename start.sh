#!/bin/bash
# Script de lancement pour l'application Home Trainer

# Vérification que le dossier venv existe
if [ ! -d "venv" ]; then
    echo "L'environnement virtuel 'venv' n'existe pas. Veuillez le créer."
    exit 1
fi

# Lancement de l'application avec le python de l'environnement virtuel
./venv/bin/python script.py
