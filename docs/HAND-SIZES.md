# Håndfrugter og æg — Lille / Normal / Stor

Status: forslag til godkendelse (2026-10-02). Kilden til tallene er
`src/lib/hand-sizes.ts`; tabellerne herunder er genereret fra den.

## Regler

- Gælder frugt og snack-grøntsager, man spiser hele, samt æg.
- Tre størrelser: **Lille**, **Normal**, **Stor**. Normal er startmængden.
- Hver størrelse har **hel vægt** (som på køkkenvægten) og **spiselig vægt**.
- Spiselig vægt = hel vægt minus USDA's spild-procent for skræl, sten,
  kernehus eller skal. Det er den spiselige vægt, der registreres, fordi
  kalorier pr. 100 g gælder den spiselige del.
- Spild-procenterne er USDA's (National Nutrient Database, SR Legacy).
  Kiwi og bladselleri er markeret "skøn", fordi USDA-tallet ikke kunne
  bekræftes herfra.
- Mål er hele varen: **Ø** for runde, **længde × Ø** for aflange.
- Æg følger EU-klasserne: S under 53 g, M 53–63 g og L 63–73 g med skal.
- Hel vægt er repræsentative midtværdier, afrundet til 5 g. De er ikke målt
  på danske varer.
- Kun rå varer. Tørret, juice, konserves, frost osv. får ingen størrelser.
  Æg må også være kogte eller stegte.

## Visning

- Tre fliser over mængdeboksen, Lille til venstre og Stor til højre, som
  vandsidens beholdere.
- Hver flise viser mål, hel vægt og den spiselige vægt, fx "185 g" og
  "118 g uden skræl" for en normal banan.
- Stor-billedet er 76 px højt (vandsiden bruger 46–56 px). Lille og Normal er
  skaleret lineært efter hel vægt: Æble Lille (135 g) står i 53 % af Stor
  (255 g).
- Et tryk sætter den spiselige vægt i mængdeboksen, og kalorierne følger med.
  Ændres mængden med +/−, er ingen flise valgt.
- Kobles på varens navn (første kommaled, fx "Æble" i "Æble, med skræl, rå").

### Frugt

| Vare | Lille | Normal | Stor | Spild |
| --- | --- | --- | --- | --- |
| Æble | Ø6,5 cm<br>135 g hel<br>122 g spiseligt | Ø7,5 cm<br>185 g hel<br>167 g spiseligt | Ø8,5 cm<br>255 g hel<br>230 g spiseligt | 10 % kernehus (USDA) |
| Appelsin | Ø6,5 cm<br>150 g hel<br>110 g spiseligt | Ø7,5 cm<br>205 g hel<br>150 g spiseligt | Ø8,5 cm<br>275 g hel<br>201 g spiseligt | 27 % skræl (USDA) |
| Mandarin | Ø5 cm<br>75 g hel<br>56 g spiseligt | Ø6 cm<br>100 g hel<br>74 g spiseligt | Ø7 cm<br>135 g hel<br>100 g spiseligt | 26 % skræl (USDA) |
| Klementin | Ø5 cm<br>65 g hel<br>50 g spiseligt | Ø5,5 cm<br>85 g hel<br>65 g spiseligt | Ø6,5 cm<br>110 g hel<br>85 g spiseligt | 23 % skræl (USDA) |
| Fersken | Ø6 cm<br>115 g hel<br>110 g spiseligt | Ø7 cm<br>150 g hel<br>144 g spiseligt | Ø8 cm<br>195 g hel<br>187 g spiseligt | 4 % sten (USDA) |
| Nektarin | Ø5,5 cm<br>110 g hel<br>100 g spiseligt | Ø6,5 cm<br>150 g hel<br>137 g spiseligt | Ø7,5 cm<br>185 g hel<br>168 g spiseligt | 9 % sten (USDA) |
| Blomme | Ø4 cm<br>45 g hel<br>42 g spiseligt | Ø5 cm<br>65 g hel<br>61 g spiseligt | Ø6 cm<br>90 g hel<br>85 g spiseligt | 6 % sten (USDA) |
| Abrikos | Ø3,5 cm<br>30 g hel<br>28 g spiseligt | Ø4,5 cm<br>40 g hel<br>37 g spiseligt | Ø5,5 cm<br>55 g hel<br>51 g spiseligt | 7 % sten (USDA) |
| Figen (frisk) | Ø4 cm<br>40 g hel<br>40 g spiseligt | Ø5 cm<br>50 g hel<br>50 g spiseligt | Ø6 cm<br>65 g hel<br>64 g spiseligt | 1 % stilk (USDA) |
| Sharonfrugt / kaki | Ø6 cm<br>155 g hel<br>130 g spiseligt | Ø7 cm<br>200 g hel<br>168 g spiseligt | Ø8 cm<br>260 g hel<br>218 g spiseligt | 16 % skræl og bæger (USDA) |
| Banan | 16 × Ø3,2 cm<br>155 g hel<br>99 g spiseligt | 19 × Ø3,5 cm<br>185 g hel<br>118 g spiseligt | 22 × Ø3,8 cm<br>220 g hel<br>141 g spiseligt | 36 % skræl (USDA) |
| Pære | 8 × Ø6 cm<br>145 g hel<br>131 g spiseligt | 10 × Ø6,5 cm<br>190 g hel<br>171 g spiseligt | 12 × Ø7,5 cm<br>255 g hel<br>230 g spiseligt | 10 % kernehus (USDA) |
| Kiwi | 5,5 × Ø4,5 cm<br>65 g hel<br>56 g spiseligt | 6,5 × Ø5 cm<br>80 g hel<br>69 g spiseligt | 7,5 × Ø5,5 cm<br>105 g hel<br>90 g spiseligt | 14 % skræl (skøn) |

### Snack-grøntsager

| Vare | Lille | Normal | Stor | Spild |
| --- | --- | --- | --- | --- |
| Gulerod | 15 × Ø2,5 cm<br>55 g hel<br>49 g spiseligt | 18 × Ø3 cm<br>80 g hel<br>71 g spiseligt | 21 × Ø3,5 cm<br>105 g hel<br>93 g spiseligt | 11 % top og skræl (USDA) |
| Snackagurk | 10 × Ø2,5 cm<br>50 g hel<br>49 g spiseligt | 13 × Ø3 cm<br>70 g hel<br>68 g spiseligt | 16 × Ø3,5 cm<br>105 g hel<br>102 g spiseligt | 3 % ender (USDA) |
| Snackpeberfrugt | 7 × Ø3 cm<br>25 g hel<br>21 g spiseligt | 9 × Ø3,5 cm<br>35 g hel<br>29 g spiseligt | 11 × Ø4 cm<br>50 g hel<br>41 g spiseligt | 18 % stilk og kerner (USDA) |
| Bladselleri (stilk) | 20 × Ø2 cm<br>35 g hel<br>31 g spiseligt | 25 × Ø2,5 cm<br>45 g hel<br>40 g spiseligt | 30 × Ø3 cm<br>65 g hel<br>58 g spiseligt | 11 % ender (skøn) |
| Tomat | Ø5 cm<br>65 g hel<br>59 g spiseligt | Ø6,5 cm<br>130 g hel<br>118 g spiseligt | Ø8 cm<br>200 g hel<br>182 g spiseligt | 9 % stilkfæste (USDA) |

### Æg

| Vare | Lille | Normal | Stor | Spild |
| --- | --- | --- | --- | --- |
| Æg | 5,3 × Ø4 cm<br>48 g hel<br>42 g spiseligt | 5,7 × Ø4,3 cm<br>58 g hel<br>51 g spiseligt | 6 × Ø4,5 cm<br>68 g hel<br>60 g spiseligt | 12 % skal (USDA) |
