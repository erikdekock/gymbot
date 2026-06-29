# DESIGN LOCK — De Reis (canoniek)

> Dit is de **canonieke** ontwerp-referentie. Staat bovenaan elk ticket. Wijzigt alleen
> wanneer expliciet een nieuwe DESIGN LOCK wordt vastgesteld.

## CONCEPT
Arthur is de gids. Hij leidt haar in DRIE etappes naar de bestemming die écht bij haar past.
De drie etappes vormen samen één reis van ochtend → nacht.

## STRUCTUUR
- 3 etappes (levels), dezelfde run, elk een ander tijdstip: etappe 1 ochtend, 2 schemering,
  3 nacht — via een per-level offset in de BESTAANDE dag→nacht-curve (geen nieuwe art).
- Startscherm wordt een REISHUB / level-select: 3 tegels (Etappe 1/2/3), elk in z'n tijd-van-
  de-dag-tint; lineair ontgrendeld; gehaalde etappe gemarkeerd. Tussen etappes terug naar de hub.
- Voortgang + kaartentelling leven in het GEHEUGEN. De pagina herlaadt nooit tussen etappes.

## PER ETAPPE
- Speel de run. 3 levens voor obstakels: overburen-katten = spatie, Ritchie (hond) = ↑, Erik = ↓.
- CLIMAX aan het eind (optie A): bij het hek verschijnt een hoepel in het MIDDEN; spring er op het
  juiste moment doorheen. Raak → VUURWERK → etappe gehaald. Mis → etappe MISLUKT → opnieuw doen.
  Levens op tijdens de run → ook opnieuw. (Bewust wat moeilijker, op verzoek.)

## BELONING / KAARTEN
- Elke gehaalde etappe → 3 pakjes. Per pakje 3 kaarten (géén tekst), kies er 1 op gevoel.
  3 etappes × 3 pakjes = 9 keuzes. Elke keuze = één stem op een stad.
- Pakje = 3 kaarten, drie VERSCHILLENDE thema's, één per stad (Marseille/Palermo/Bilbao), geschud.
  Alle 27 kaarten precies één keer over de 9 pakjes; posities (links/midden/rechts) én pakje-
  volgorde geschud.

## REVEAL
- Na de 9e keuze → tel de stemmen → stad met de meeste wint → BESTAANDE reveal (CITYDATA).
  Gelijkspel → haar 9e (laatste) keuze beslist.

## RANDVOORWAARDEN (altijd)
Eén offline single-file HTML, NL in-game tekst, geen regressie, aquarel/perspectief intact.
