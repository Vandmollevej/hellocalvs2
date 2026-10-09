-- Admin > Flows: "Oprettelse" (opsætningsguiden efter oprettelse), deaktiveret kladde.
INSERT INTO "flows" ("id", "name", "description", "enabled")
VALUES ('flow_oprettelse', 'Oprettelse', 'Opsætningsguide ved oprettelse af ny bruger. Deaktiveret indtil videre.', false)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "flow_pages" ("id", "flowId", "sortOrder", "title", "bodyHtml", "buttonLabel") VALUES
('flow_oprettelse_1', 'flow_oprettelse', 0, 'Integrer dit smartwatch', '<p>For at gøre opsætningen lettere, kan du med fordel integrere dit ur allerede nu og indlæse dit aktivitetsniveau.</p><p>[Knap: Integrér smartwatch]</p><p>Pil tilbage på både denne side og selve integrationen, så man kan fortsætte til guiden. Guiden lukker ikke, når man går tilbage.</p>', 'Fortsæt til guiden'),
('flow_oprettelse_2', 'flow_oprettelse', 1, 'Har du en smart-vægt?', '<p>Har du en smart-vægt? Hvis du integrerer den, slipper du for at angive startvægt.</p><p>[Knap: Integrér smart-vægt]</p>', 'Næste'),
('flow_oprettelse_3', 'flow_oprettelse', 2, 'Vægt, højde og fødselsdato', '<p>Hvis ikke ovenstående er integreret: indtast vægt og højde (højde uanset), alder og fødselsdato.</p><p>Under fødselsdato: Vi skal bruge din fødselsdato for at tilpasse din forbrænding og fysik.</p>', 'Næste'),
('flow_oprettelse_4', 'flow_oprettelse', 3, 'Søvnrytmer', '<p>Søvnen kan have stor indflydelse på vægt og trivsel. Se dit liv i et større perspektiv, når du har indsamlet nok data. Standard søvn sættes til 22.00 - 07.00</p>', 'Næste'),
('flow_oprettelse_5', 'flow_oprettelse', 4, 'Sæt dit mål', '<p>Sæt dig dit første mål. Senere kan du også indsætte delmål.</p>', 'Næste'),
('flow_oprettelse_6', 'flow_oprettelse', 5, 'Allergier', '<p>Har du allergier eller fødevarer, du ønsker at undgå?</p>', 'Næste'),
('flow_oprettelse_7', 'flow_oprettelse', 6, 'Hello Fresh', '<p>Abonnerer du på Hello Fresh? Så kan du allerede nu koble dit abonnement til, så det er nemt at registrere dine kalorier.</p>', 'Færdig')
ON CONFLICT ("id") DO NOTHING;
