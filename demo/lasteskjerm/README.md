# Verdensløpet – animert lasteskjerm

Testprototype av en lasteskjerm til treningsappen. Den er ikke en del av
DAM-appen og bygges ikke av Next.js. Alt ligger i én fil, `index.html`, uten
avhengigheter. Du tester den ved å åpne filen i en nettleser.

## Hva den gjør

- En utøver er i aktivitet midt på skjermen: løping (mann og kvinne), sykling,
  langrenn, svømming, roing, skøyter og rullestolløp.
- Bak utøveren står et kjent landemerke: Holmenkollbakken, Eiffeltårnet,
  Big Ben, Frihetsgudinnen, Kristus-statuen, Fuji, Colosseum, pyramidene i Giza,
  Operahuset i Sydney, Bryggen, Golden Gate, Taj Mahal, Det skjeve tårnet i
  Pisa, Ishavskatedralen (med nordlys), Burj Khalifa og Den kinesiske mur.
- Hvert 3,2. sekund skjer ett bytte. Først byttes aktiviteten, så bakgrunnen,
  så aktiviteten igjen, og slik fortsetter det.
- Når aktiviteten byttes, ser det ut som en stafettveksling: den gamle utøveren
  drar ifra, og den nye kommer inn bakfra. Underlaget skifter samtidig mellom
  vei, snø, vann, is og friidrettsbane.
- Løping vises alltid både som mann og kvinne. De andre idrettene bytter kjønn
  for hver runde, og hudfarge og hårfarge varierer.

## Testkontroller

| Knapp / tast      | Virkning                  |
| ----------------- | ------------------------- |
| Pause / mellomrom | Stopper og starter        |
| Ny aktivitet / A  | Neste idrett med én gang  |
| Nytt sted / S     | Neste landemerke med én gang |
| Tempo / T         | Veksler mellom 1×, 2× og ½× |

Nederst viser et panel startnummer, idrett, sted og koordinater, og en
simulert fremdriftslinje. Når appen tar den i bruk, kobles fremdriften til
ekte lasting.

## Slik er koden bygget opp

Alt tegnes i ett `<canvas>`:

- `SPORTS`: én tegnefunksjon per idrett. Figurene er piktogrammer der hvert
  ledd regnes ut fra en fase. Sykkel, ski, roing og rullestol bruker invers
  kinematikk for å holde hender og føtter på pedaler, staver og årer.
- `LM`: landemerkene. De tegnes med enkle former og mellomlagres som bilder.
- `PLACES`: himmelfarger, sol/måne, bakgrunnsterreng, lys og tekst per sted.
- `ACTS`: rekkefølgen på aktivitetene.
- `st.interval` styrer hvor lenge det går mellom hvert bytte.

Har brukeren slått på `prefers-reduced-motion`, går animasjonen saktere, og
figurene glir ikke inn og ut ved bytte.

For integrering finnes det et lite API på `window.Verdenslopet`:
`nextActivity()`, `nextPlace()`, `pause()`, `play()` og `set(aktivitet, sted)`.
