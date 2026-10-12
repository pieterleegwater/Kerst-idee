# Dino-plaatjes maken (AI)

Maak met een beeldgenerator (ChatGPT-afbeeldingen, Midjourney, Leonardo, Ideogram…) **19 plaatjes**, één per soort.
Plak telkens **de basisprompt + de regel van de soort**. Sla elk plaatje op met de **bestandsnaam** uit de tabel
(PNG of JPG, liefst 1024×1024) en zet ze in de map `dino/public/img/dino/`. Of stuur ze gewoon in de chat; dan zet ik ze goed.

Daarna doe ik de rest: achtergrond wegknippen, op de rijk-achtergronden (vulkaan, ijs, oerwoud, diepzee, storm, maan) zetten,
en alle effecten (Holo, Goudfolie, Prisma, Oerkristal) eroverheen.

> ⚠️ Controleer in de voorwaarden van je AI-tool dat je de plaatjes commercieel mag gebruiken (bij de meeste betaalde abonnementen mag dat).

## Basisprompt (altijd ervoor plakken)

```
Photorealistic paleoart of a single [SOORT], scientifically accurate anatomy, full body visible from head to tail tip,
side view facing right, dynamic powerful pose, dramatic cinematic studio lighting with rim light, highly detailed skin texture,
centered, isolated on a plain flat light grey background, no scenery, no text, no watermark, square image
```

## Per soort

| Bestand | Vul in bij [SOORT] |
|---|---|
| `rex.png` | Tyrannosaurus rex, massive head with open jaws showing teeth, small arms, slight feather fuzz on the back |
| `raptor.png` | Velociraptor, fully feathered like a bird, long tail feathers, sickle claw raised, turkey-sized |
| `spino.png` | Spinosaurus, tall sail on its back, long crocodile-like snout, semi-aquatic |
| `allo.png` | Allosaurus, large predatory theropod with small horn crests above the eyes |
| `carno.png` | Carnotaurus, two short bull-like horns above the eyes, tiny arms, muscular legs |
| `dilo.png` | Dilophosaurus, two thin bony crests on top of the head, slender body (no frill) |
| `brachio.png` | Brachiosaurus, very long upright neck, front legs longer than back legs |
| `diplo.png` | Diplodocus, extremely long horizontal neck and whip-like tail |
| `titan.png` | Argentinosaurus, gigantic titanosaur sauropod, enormous body, long neck and tail |
| `tri.png` | Triceratops, three horns and a large bony neck frill, bulky body |
| `styraco.png` | Styracosaurus, neck frill crowned with long spikes, single large nose horn |
| `pachy.png` | Pachyrhinosaurus, thick bony boss on the nose instead of a horn, frill with small spikes |
| `stego.png` | Stegosaurus, two rows of large plates along the back, four spikes on the tail |
| `anky.png` | Ankylosaurus, heavily armored with bony plates, wide low body, big club at the end of the tail |
| `kentro.png` | Kentrosaurus, smaller stegosaur with plates turning into long spikes toward the tail |
| `ptera.png` | Pteranodon, flying pterosaur with wings spread wide, long backward-pointing head crest, toothless beak |
| `quetzal.png` | Quetzalcoatlus, giant azhdarchid pterosaur with wings spread, very long neck and beak |
| `mosa.png` | Mosasaurus, huge marine reptile swimming, shark-like tail fin, flippers, jaws full of teeth (underwater lighting is ok, background still plain) |
| `plesio.png` | Plesiosaurus, marine reptile with very long neck, small head, four large flippers, swimming |

## Tips voor één mooie set
- Gebruik **steeds dezelfde basisprompt**, zodat de stijl overal gelijk is.
- Kies per soort het mooiste plaatje uit de varianten die de tool geeft.
- Is een achtergrond toch niet effen? Geen probleem: stuur hem toch, ik kijk wat ik kan wegknippen.
- **Optioneel, extra gaaf:** maak voor de 6 Legendarische kaarten een volledige scène (zonder "plain background"):
  - Vulkaankoning **Rex**: *"…standing in front of an erupting volcano, lava glow"*
  - IJskeizer **Titan**: *"…in a blizzard on an ice field"*
  - Oerwoudvorst **Brachio**: *"…in a misty prehistoric jungle with god rays"*
  - Diepzeetitan **Mosa**: *"…in the deep blue ocean with light beams from above"*
  - Stormheerser **Quetzal**: *"…flying through a thunderstorm with lightning"*
  - Maanvorst **Raptor**: *"…on a rock under a giant full moon at night"*

  Ze staan in de site als `public/img/dino/legend-<naam>.jpg` (rex, titan, brachio, mosa, quetzal, raptor). Welk deel van de scène op een gewone kaart zichtbaar is, stel je in met `LEGEND_FOCUS` in `public/art.js`.

## Scherpte
Gemini levert kleine rasters (ongeveer 200 px per dino). Daarom worden ze eerst 4× vergroot met de AI-upscaler Real-ESRGAN
(`tools/upscale_esrgan.py`) en daarna geknipt met `tools/slice_grid.py`. Nog scherper: laat Gemini de rijen los maken in hoge resolutie.
