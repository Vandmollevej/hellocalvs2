-- Remove only the untouched, disabled duplicate seed. Preserve edited or used flows.
WITH seed (id, "flowId", "sortOrder", title, "bodyHtml", "buttonLabel") AS (VALUES
('flow_oprettelse_1', 'flow_oprettelse', 0, 'Integrer dit smartwatch', '<p>For at gøre opsætningen lettere, kan du med fordel integrere dit ur allerede nu og indlæse dit aktivitetsniveau.</p><p>[Knap: Integrér smartwatch]</p><p>Pil tilbage på både denne side og selve integrationen, så man kan fortsætte til guiden. Guiden lukker ikke, når man går tilbage.</p>', 'Fortsæt til guiden'),
('flow_oprettelse_2', 'flow_oprettelse', 1, 'Har du en smart-vægt?', '<p>Har du en smart-vægt? Hvis du integrerer den, slipper du for at angive startvægt.</p><p>[Knap: Integrér smart-vægt]</p>', 'Næste'),
('flow_oprettelse_3', 'flow_oprettelse', 2, 'Vægt, højde og fødselsdato', '<p>Hvis ikke ovenstående er integreret: indtast vægt og højde (højde uanset), alder og fødselsdato.</p><p>Under fødselsdato: Vi skal bruge din fødselsdato for at tilpasse din forbrænding og fysik.</p>', 'Næste'),
('flow_oprettelse_4', 'flow_oprettelse', 3, 'Søvnrytmer', '<p>Søvnen kan have stor indflydelse på vægt og trivsel. Se dit liv i et større perspektiv, når du har indsamlet nok data. Standard søvn sættes til 22.00 - 07.00</p>', 'Næste'),
('flow_oprettelse_5', 'flow_oprettelse', 4, 'Sæt dit mål', '<p>Sæt dig dit første mål. Senere kan du også indsætte delmål.</p>', 'Næste'),
('flow_oprettelse_6', 'flow_oprettelse', 5, 'Allergier', '<p>Har du allergier eller fødevarer, du ønsker at undgå?</p>', 'Næste'),
('flow_oprettelse_7', 'flow_oprettelse', 6, 'Hello Fresh', '<p>Abonnerer du på Hello Fresh? Så kan du allerede nu koble dit abonnement til, så det er nemt at registrere dine kalorier.</p>', 'Færdig')
)
DELETE FROM "flows" f
WHERE f.id = 'flow_oprettelse'
  AND f.name = 'Oprettelse'
  AND f.description = 'Opsætningsguide ved oprettelse af ny bruger. Deaktiveret indtil videre.'
  AND f.enabled = false AND f.kind = 'popup' AND f.conditions IS NULL
  AND f.priority = 0 AND f."maxShows" = 1
  AND EXISTS (SELECT 1 FROM "flows" WHERE id = 'flow_opsaetning_v1')
  AND NOT EXISTS (SELECT 1 FROM "flow_views" WHERE "flowId" = f.id)
  AND (SELECT count(*) FROM "flow_pages" WHERE "flowId" = f.id) = 7
  AND NOT EXISTS (
    SELECT 1 FROM "flow_pages" p LEFT JOIN seed s ON s.id = p.id
    WHERE p."flowId" = f.id AND (s.id IS NULL
      OR p."sortOrder" <> s."sortOrder" OR p.title <> s.title
      OR p."bodyHtml" <> s."bodyHtml" OR p."buttonLabel" <> s."buttonLabel"
      OR p."actionLabel" IS NOT NULL OR p."actionHref" IS NOT NULL)
  );
