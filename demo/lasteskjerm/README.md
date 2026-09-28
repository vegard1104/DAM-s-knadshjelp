# Verdensløpet – animert lasteskjerm

Testprototype av en lasteskjerm til treningsappen. Den er ikke en del av
DAM-appen og bygges ikke av Next.js. Hver fil er selvstendig, uten
avhengigheter. Du tester den ved å åpne filen i en nettleser.

| Fil              | Hva                                                                 |
| ---------------- | ------------------------------------------------------------------- |
| `index.html`     | Den forenklede lasteskjermen, slik den ligger i treningsappen.      |
| `detaljert.html` | Den første versjonen, med himmel, lys, drakter og startnummer.      |

## Den forenklede versjonen (`index.html`)

Laget for å vises mens appen starter, så den har få elementer og få farger:

- Bakgrunnen er appens egen (lys `#F2F2F7`, mørk `#0E0F13`), så overgangen
  til appen er sømløs.
- Utøveren er et piktogram i appens hovedfarge. Armen og beinet bak er en
  blekere variant av samme farge. Kvinner har hestehale; ellers er det ingen
  drakter, hudfarger eller hodeplagg.
- Utstyr (sykkel, ski, staver, båt, rullestol) er i en nøytral grå.
- Landemerket er én blek silhuett. Buer, urskive og vinduer er skåret ut av
  flaten i stedet for å tegnes i en ny farge.
- Bakken er en tynn linje med korte streker som glir forbi. For svømming og
  roing er den en bølgelinje, og det som er under vannflaten tones ut.
- Under bakken står idretten, stedet («Eiffeltårnet, Paris») og en tynn
  fremdriftslinje. Nederst står «AI Trener».

Styrelinja øverst er bare for forhåndsvisningen: bytt mellom lys og mørk
drakt, velg en av appens seks hovedfarger, og trykk «Appen er klar» for å se
uttoningen.

Rekkefølgen er den samme som før: først byttes idretten, 1,5 sekunder senere
stedet, og så står kombinasjonen i 3,2 sekunder før neste idrett. Idretter:
løping (mann og kvinne), sykling, langrenn, svømming, roing, skøyter og
rullestolløp. Steder: Holmenkollbakken, Eiffeltårnet, Big Ben,
Frihetsgudinnen, Kristus-statuen, Fuji, Colosseum, pyramidene i Giza,
Operahuset, Bryggen, Golden Gate, Taj Mahal, Det skjeve tårnet i Pisa,
Ishavskatedralen, Burj Khalifa og Den kinesiske mur.

## Slik er koden bygget opp

`lasteskjermMotor()` tegner scenen i et `<canvas>`. Den kjører i en Web Worker
på et `OffscreenCanvas`, så animasjonen går jevnt selv om hovedtråden er
opptatt med å starte appen. Nettlesere uten det tegner på hovedtråden.

- `SPORTS`: én tegnefunksjon per idrett. Hvert ledd regnes ut fra en fase.
  Sykkel, ski, roing og rullestol bruker invers kinematikk for å holde hender
  og føtter på pedaler, staver og årer.
- `LM`: landemerkene, tegnet i én farge og mellomlagret som bilder.
- `PLACES`: landemerke, navn og by per sted.
- `settPalett()`: alle fargene utledes av tre verdier fra appen: bakgrunn,
  tekstfarge og hovedfarge.
- `st.actToPlace` og `st.placeToAct` styrer tidene mellom byttene.

`window.ATLasteskjerm` har `vis()` og `ferdig()`. Appen kaller `ferdig()` når
den er klar; da vises skjermen i minst 1,5 sekunder totalt før den toner ut.

Har brukeren slått på `prefers-reduced-motion`, går animasjonen saktere, og
figurene glir ikke inn og ut ved bytte.
