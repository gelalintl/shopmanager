-- Ajoute le mode de règlement Carte pour la caisse rapide.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD';
