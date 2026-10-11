# -*- coding: utf-8 -*-
"""
Omlægger rå scraper-ark (Edeka, Rewe, DM, Wolt) til Bilkas endelige 35-kolonne-layout
efter mønstret i Bilka_moenster_egne_felter.md ("hver oplysning står ét sted").

Kør:  python omlaeg_ark.py            -> skriver <butik>_ny.xlsx + Omlaegning_rapport.md
      python omlaeg_ark.py edeka dm   -> kun de nævnte butikker

Originalarkene røres ikke. Tekstsproget bevares (tysk i tyske ark, dansk i Wolt);
kun flag-værdier er sprogneutrale som i Bilka-arket (Yes / Frozen).
"""
import re, sys, os, random, collections
import openpyxl
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))

TARGET = ['HelloCal_Title', 'Product Name', 'Original Title', 'Subtitle', 'Quantity', 'Brand', 'Subbrand',
          'EAN', 'Pack Count', 'Product Type', 'Variation', 'Category', 'Packaging', '_is_alcohol',
          '_is_country_of_origen', '_is_organic', '_is_glutenfree', '_is_lactose_free', 'Keyword 1',
          'Keyword 2', 'Keyword 3', 'Keyword 4', 'Keyword 5', 'Source URL', 'Manufacturer', 'Image File',
          'Parse Status', '_is_sweeteners', '_is_meat', '_is_vegan', '_is_allergy', '_is_sugar_free',
          '_is_fat', '_is_alcohol_pct', 'Clean Subtitle']
# Bilka-arket har to kolonner der begge hedder _is_alcohol; den anden (procent) skrives med samme navn.
HEADER_OUT = [h if h != '_is_alcohol_pct' else '_is_alcohol' for h in TARGET]

# ----------------------------------------------------------------------------------------------
# Sprogordbøger
# ----------------------------------------------------------------------------------------------
DE = dict(
    lang='de',
    organic=r'\b(bio|biologisch\w*|öko|ökologisch\w*|demeter|naturland|bioland)\b|\bbio-',
    organic_strip=r'\b(?:in\s+)?[Bb]io-Qualität\b|\b[Bb]io(?:-|\s+)|\b[Bb]io\b|\b[Öö]ko\b',
    sugar_free=r'\bzuckerfrei\w*\b|\bohne\s+zucker\b',
    no_added_sugar=r'\bohne\s+zuckerzusatz\b|\bohne\s+zusatz\s+von\s+zucker\b',
    gluten_free=r'\bglutenfrei\w*\b',
    lactose_free=r'\blaktosefrei\w*\b|\blactosefrei\w*\b',
    vegan=r'\bvegan\w*\b',
    vegetarian=r'\bvegetarisch\w*\b|\bveggie\b',
    sweeteners=r'\bsüßungsmittel\w*\b|\bsüssungsmittel\w*\b|\bsüßstoff\w*\b|\bsüssstoff\w*\b',
    alcohol_free=r'\balkoholfrei\w*\b',
    frozen=r'\btiefgefroren\b|\btiefkühl\w*\b|\btk\b|\bgefroren\b',
    fat=r'(\d+(?:[.,]\d+)?)\s*%\s*(?:fett|fett\s*i\.?\s*tr\.?|fettgehalt)',
    fat_dairy_words=r'\b(milch|sahne|quark|joghurt|jogurt|käse|frischkäse|schmand|skyr|kefir|buttermilch|crème|creme fraîche|mascarpone|ricotta|mozzarella|gouda|emmentaler|butter|margarine|hackfleisch|hack)\b',
    alcohol_pct=r'(\d+(?:[.,]\d+)?)\s*%\s*(?:vol\.?|alkohol|alc\.?)',
    alcohol_cats=r'wein|sekt|prosecco|champagner|bier|pils|weizen|gin|rum|whisky|whiskey|likör|liköre|vodka|wodka|brände|brand|schnaps|spirituose|wermut|aperitif|cognac|brandy|tequila|mezcal|ouzo|grappa|sake|cidre|cider|glühwein|punsch|schottland|irland|kentucky|highland|islay|speyside|-mix|longdrink|cocktail|bowle|portwein|sherry|rotwein|weißwein|rosé|rose',
    nonalc_cats=r'alkoholfrei',
    contains_alcohol='Enthält Alkohol', alcohol_free_val='Alkoholfrei', unknown_meat='Unbekannt',
    with_word=r'\s+mit\s+', and_words=r'\s+(?:und|&|sowie)\s+',
    countries={  # adjektiv/ord -> land (tysk)
        'italienisch': 'Italien', 'deutsch': 'Deutschland', 'französisch': 'Frankreich', 'spanisch': 'Spanien',
        'griechisch': 'Griechenland', 'thailändisch': 'Thailand', 'thai': 'Thailand', 'indisch': 'Indien',
        'chinesisch': 'China', 'japanisch': 'Japan', 'mexikanisch': 'Mexiko', 'türkisch': 'Türkei',
        'schweizer': 'Schweiz', 'österreichisch': 'Österreich', 'amerikanisch': 'USA', 'englisch': 'England',
        'irisch': 'Irland', 'schottisch': 'Schottland', 'portugiesisch': 'Portugal', 'argentinisch': 'Argentinien',
        'norwegisch': 'Norwegen', 'dänisch': 'Dänemark', 'holländisch': 'Niederlande', 'niederländisch': 'Niederlande',
        'belgisch': 'Belgien', 'polnisch': 'Polen', 'ungarisch': 'Ungarn', 'koreanisch': 'Korea',
        'vietnamesisch': 'Vietnam', 'marokkanisch': 'Marokko', 'kubanisch': 'Kuba', 'jamaikanisch': 'Jamaika',
        'chilenisch': 'Chile', 'südafrikanisch': 'Südafrika', 'australisch': 'Australien',
        'neuseeländisch': 'Neuseeland', 'kanadisch': 'Kanada', 'brasilianisch': 'Brasilien', 'peruanisch': 'Peru',
        'libanesisch': 'Libanon', 'persisch': 'Iran', 'ägyptisch': 'Ägypten', 'tunesisch': 'Tunesien',
        'indonesisch': 'Indonesien', 'malaysisch': 'Malaysia', 'philippinisch': 'Philippinen',
        'russisch': 'Russland', 'ukrainisch': 'Ukraine', 'schwedisch': 'Schweden', 'finnisch': 'Finnland',
        'tschechisch': 'Tschechien', 'kroatisch': 'Kroatien', 'bulgarisch': 'Bulgarien', 'rumänisch': 'Rumänien',
        'kolumbianisch': 'Kolumbien', 'äthiopisch': 'Äthiopien', 'kenianisch': 'Kenia', 'sri-lankisch': 'Sri Lanka',
    },
    country_names=['Italien', 'Deutschland', 'Frankreich', 'Spanien', 'Griechenland', 'Thailand', 'Indien', 'China',
                   'Japan', 'Mexiko', 'Türkei', 'Schweiz', 'Österreich', 'USA', 'England', 'Irland', 'Schottland',
                   'Portugal', 'Argentinien', 'Norwegen', 'Dänemark', 'Niederlande', 'Belgien', 'Polen', 'Ungarn',
                   'Korea', 'Südkorea', 'Vietnam', 'Marokko', 'Kuba', 'Jamaika', 'Chile', 'Südafrika', 'Australien',
                   'Neuseeland', 'Kanada', 'Brasilien', 'Peru', 'Libanon', 'Iran', 'Ägypten', 'Tunesien', 'Indonesien',
                   'Malaysia', 'Philippinen', 'Russland', 'Ukraine', 'Schweden', 'Finnland', 'Tschechien', 'Kroatien',
                   'Bulgarien', 'Rumänien', 'Kolumbien', 'Äthiopien', 'Kenia', 'Sri Lanka', 'Taiwan', 'Venezuela',
                   'Dominikanische Republik', 'Vereinigtes Königreich', 'Großbritannien', 'Guatemala', 'Honduras',
                   'Nicaragua', 'Costa Rica', 'Panama', 'Ecuador', 'Bolivien', 'Uruguay', 'Paraguay', 'Kalifornien',
                   'Tennessee', 'Kentucky', 'Israel', 'Pakistan', 'Nepal', 'Bangladesch', 'Kambodscha', 'Georgien',
                   'Armenien', 'Moldawien', 'Serbien', 'Slowenien', 'Slowakei', 'Litauen', 'Lettland', 'Estland',
                   'Island', 'Luxemburg', 'Zypern', 'Malta', 'Marokko', 'Algerien', 'Ghana', 'Elfenbeinküste',
                   'Nigeria', 'Madagaskar', 'Mauritius', 'Europäische Union', 'EU'],
    meat={  # ord i titel -> dyreart (tysk ental)
        'Huhn': r'\b(hähnchen\w*|huhn|hühner\w*|hühnchen|chicken|poulet|hahn|geflügel\w*)\b',
        'Pute': r'\b(pute\w*|puten\w*|truthahn\w*|turkey)\b',
        'Ente': r'\b(ente|enten\w*|duck)\b',
        'Rind': r'\b(rind\w*|rinder\w*|beef|jungbullen\w*|ochsen\w*|kalbs?rind\w*|steak\w*|roastbeef|hüftsteak|entrecôte|rumpsteak|bolognese|corned beef)\b',
        'Kalb': r'\b(kalb\w*|kalbs\w*|veal)\b',
        'Schwein': r'\b(schwein\w*|schweine\w*|pork|speck|bacon|schinken\w*|kasseler|kassler|leberkäse|mettwurst|mett|bratwurst|wiener|frankfurter|krakauer|salami|lyoner|mortadella|leberwurst|teewurst|blutwurst|rotwurst|sülze|eisbein|schnitzel|nackensteak|bauchspeck|chorizo|prosciutto|serrano|pancetta)\b',
        'Lamm': r'\b(lamm\w*|lammfleisch|lamb)\b',
        'Wild': r'\b(wild|wildfleisch|wildbret|hirsch\w*|reh|rehrücken|wildschwein\w*)\b',
        'Lachs': r'\b(lachs\w*|salmon|räucherlachs|graved\w*)\b',
        'Thunfisch': r'\b(thunfisch\w*|tuna|tonno|thun)\b',
        'Garnelen': r'\b(garnelen?|shrimps?|krabben|gambas|scampi|prawns?)\b',
        'Hering': r'\b(hering\w*|matjes\w*|bismarck\w*|rollmops|brathering)\b',
        'Forelle': r'\b(forelle\w*)\b',
        'Kabeljau': r'\b(kabeljau\w*|dorsch\w*|skrei)\b',
        'Seelachs': r'\b(seelachs\w*|alaska[- ]seelachs|schlemmerfilet)\b',
        'Makrele': r'\b(makrele\w*)\b',
        'Sardine': r'\b(sardinen?|sardellen?|anchovis)\b',
        'Zander': r'\b(zander\w*)\b',
        'Muscheln': r'\b(muscheln?|miesmuscheln?|jakobsmuscheln?|calamari|tintenfisch\w*|oktopus|pulpo|meeresfrüchte)\b',
        'Fisch': r'\b(fisch\w*|seafood|fischstäbchen|surimi|kaviar|rogen|scholle|rotbarsch|pangasius|tilapia|wels|dorade|wolfsbarsch|heilbutt|aal|sprotten|schillerlocke)\b',
        'Ei': r'\b(eier|ei|hühnerei\w*|freilandeier|bodenhaltung)\b',
    },
    meat_cats=r'fleisch|wurst|würstchen|salami|schinken|speck|kasseler|frikadelle|steak|hack|geflügel|hähnchen|pute|lamm|rind|schwein|kalb|fisch|lachs|hering|matjes|meeresfrüchte|sushi|kaviar|aufschnitt|leberkäse|mortadella|mett|sülze|rotwurst|teewurst|leberwurst|braten',
    unknown_meat_cats=r'wurst|würstchen|salami|aufschnitt|fleischsalat|frikadelle|leberkäse|mett|sülze|rotwurst|teewurst|leberwurst|schinken|kasseler|braten|steak|hack|geflügelsalat|fleisch',
    veggie_guard=r'\b(vegan\w*|vegetarisch\w*|veggie|pflanzlich\w*|fleischlos|fleischfrei|tofu|seitan|-art|art\b|geschmack)\b',
    warnings=r'(bei übermäßigem verzehr|kann abführend wirken|erhöhter koffeingehalt|für kinder|schwangere|nicht geeignet|außerhalb der reichweite|enthält geringfügige mengen|zubereitung|zubereitungshinweise|aufbewahr|lagern|verzehr)',
    process_words=['geräuchert', 'gekocht', 'gebraten', 'ultrahocherhitzt', 'homogenisiert', 'pasteurisiert',
                   'gefriergetrocknet', 'geröstet', 'gesalzen', 'ungesalzen', 'entkoffeiniert', 'gemahlen',
                   'ganze bohnen', 'löslich', 'tiefgekühlt', 'vorgegart', 'vorgewürzt', 'getrocknet', 'mariniert',
                   'paniert', 'gegrillt', 'gewürzt', 'passiert', 'stückig', 'geschält', 'kaltgepresst', 'nativ',
                   'extra nativ', 'raffiniert', 'naturtrüb', 'klar', 'koffeinhaltig', 'koffeinfrei', 'glasiert',
                   'gezuckert', 'ungezuckert', 'gesüßt', 'ungesüßt', 'fettarm', 'halbfett', 'mager', 'vollfett',
                   'light', 'zero', 'trocken', 'halbtrocken', 'lieblich', 'feinherb', 'süß', 'mild', 'scharf',
                   'mittelscharf', 'extra scharf', 'würzig', 'pikant', 'regional', 'gekühlt', 'fairtrade', 'msc',
                   'einweg', 'mehrweg', 'pfand'],
)

DA = dict(
    lang='da',
    organic=r'\b(øko|økologisk\w*|organic)\b|\bøko-',
    organic_strip=r'\b[Øø]ko(?:-|\s+)|\b[Øø]kologisk\w*\b|\b[Øø]ko\b|\bORGANIC\b|\bOrganic\b',
    sugar_free=r'\bsukkerfri\w*\b|\buden\s+sukker\b|\b0\s*%\s*sugar\b|\bsugar\s*free\b',
    no_added_sugar=r'\bu(?:den|\.)\s+tilsat\s+sukker\b',
    gluten_free=r'\bglutenfri\w*\b',
    lactose_free=r'\blaktosefri\w*\b',
    vegan=r'\bvegansk\w*\b|\bvegan\b',
    vegetarian=r'\bvegetarisk\w*\b|\bvegetar\b',
    sweeteners=r'\bsødestof\w*\b|\bsødemid\w*\b|\bstevia\b',
    alcohol_free=r'\balkoholfri\w*\b',
    frozen=r'\bfrost\b|\bfrosne?\b|\bfrossen\b|\bdybfros\w*\b',
    fat=r'(\d+(?:[.,]\d+)?)\s*%\s*(?:fedt)',
    fat_dairy_words=r'\b(mælk|fløde|skyr|yoghurt|ymer|ost|kvark|cheasy|hakket|a38|kefir|creme fraiche|hytteost)\b',
    alcohol_pct=r'(\d+(?:[.,]\d+)?)\s*%\s*(?:vol\.?|alkohol|alc\.?)',
    alcohol_cats=r'vin|øl|spiritus|snaps|gin|rom|whisky|vodka|likør|cider|drink',
    nonalc_cats=r'alkoholfri',
    contains_alcohol='Indeholder alkohol', alcohol_free_val='Alkoholfri', unknown_meat='Ukendt',
    with_word=r'\s+(?:med|m\.|m)\s+', and_words=r'\s+(?:og|&)\s+',
    countries={
        'italiensk': 'Italien', 'græsk': 'Grækenland', 'kinesisk': 'Kina', 'koreansk': 'Korea', 'japansk': 'Japan',
        'thai': 'Thailand', 'thailandsk': 'Thailand', 'indisk': 'Indien', 'fransk': 'Frankrig', 'spansk': 'Spanien',
        'tyrkisk': 'Tyrkiet', 'mexicansk': 'Mexico', 'dansk': 'Danmark', 'svensk': 'Sverige', 'norsk': 'Norge',
        'tysk': 'Tyskland', 'amerikansk': 'USA', 'vietnamesisk': 'Vietnam', 'libanesisk': 'Libanon',
        'marokkansk': 'Marokko', 'engelsk': 'England', 'irsk': 'Irland', 'skotsk': 'Skotland', 'hollandsk': 'Holland',
        'belgisk': 'Belgien', 'polsk': 'Polen', 'portugisisk': 'Portugal', 'argentinsk': 'Argentina',
        'brasiliansk': 'Brasilien', 'filippinsk': 'Filippinerne', 'indonesisk': 'Indonesien', 'malaysisk': 'Malaysia',
    },
    country_names=['Italien', 'Grækenland', 'Kina', 'Korea', 'Japan', 'Thailand', 'Indien', 'Frankrig', 'Spanien',
                   'Tyrkiet', 'Mexico', 'Danmark', 'Sverige', 'Norge', 'Tyskland', 'USA', 'Vietnam', 'Libanon',
                   'Marokko', 'England', 'Irland', 'Skotland', 'Holland', 'Belgien', 'Polen', 'Portugal', 'Argentina',
                   'Brasilien', 'Filippinerne', 'Indonesien', 'Malaysia', 'Taiwan'],
    meat={
        'Kylling': r'\b(kylling\w*|kyll\.?|chicken|høns\w*|hane\w*)\b',
        'Kalkun': r'\b(kalkun\w*)\b',
        'And': r'\b(and|ande\w*|duck)\b',
        'Okse': r'\b(okse\w*|beef|bøf\w*|hakket\s+okse\w*|roastbeef|entrecote|culotte)\b',
        'Kalv': r'\b(kalv\w*)\b',
        'Gris': r'\b(gris\w*|svin\w*|flæsk\w*|pork|bacon|skinke\w*|hamburgerryg|pølse\w*|salami|spegepølse|leverpostej|medister\w*|frikadelle\w*|kam|nakke\w*|mørbrad|rullepølse|kødpølse|wienerpølse\w*|frankfurter|chorizo|parmaskinke|serrano|saltkød|sommergriller)\b',
        'Lam': r'\b(lam|lamme\w*|lamb)\b',
        'Laks': r'\b(laks\w*|salmon|gravad\w*)\b',
        'Tun': r'\b(tun|tunfisk|tuna)\b',
        'Rejer': r'\b(rejer?|grønlandsrejer|shrimps?|scampi)\b',
        'Sild': r'\b(sild\w*|matjes)\b',
        'Torsk': r'\b(torsk\w*)\b',
        'Sej': r'\b(sej|sejfilet)\b',
        'Makrel': r'\b(makrel\w*)\b',
        'Rødspætte': r'\b(rødspætte\w*)\b',
        'Muslinger': r'\b(musling\w*|blåmusling\w*|blæksprutte\w*|skaldyr|seafood)\b',
        'Fisk': r'\b(fisk\w*|fiskefilet\w*|fiskefrikadelle\w*|fiskepinde|surimi|kaviar|stenbiderrogn|rogn)\b',
        'Æg': r'\b(æg|helæg|skrabeæg|frilandsæg|økoæg)\b',
    },
    meat_cats=r'kød|fisk|pålæg|fjerkræ',
    unknown_meat_cats=r'pølse|pålæg|frikadelle|kødsalat',
    veggie_guard=r'\b(vegansk\w*|vegetarisk\w*|veggie|plantebaseret|vegetar|-smag|smag\b)\b',
    warnings=r'(bør ikke indtages|højt koffeinindhold|kan have afførende|opbevar|tilberedning|nedfryses)',
    process_words=['røget', 'kogt', 'stegt', 'pasteuriseret', 'optøet', 'forstegt', 'frysetørret', 'ristet',
                   'saltet', 'usaltet', 'koffeinfri', 'malet', 'hele bønner', 'instant', 'marineret', 'paneret',
                   'grillet', 'krydret', 'koldpresset', 'ekstra jomfru', 'light', 'zero', 'naturel', 'mild', 'stærk',
                   'sød', 'tør', 'halvtør', 'friske', 'frisk', 'tørret', 'afskåret', 'skiveskåret', 'revet',
                   'hakket', 'tilsat kulsyre', 'uden tilsat sukker', 'pant', 'vægtvare'],
)

# ----------------------------------------------------------------------------------------------
# Generelle hjælpere
# ----------------------------------------------------------------------------------------------
QTY_RE = re.compile(r'(?<![\w,.])(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramm|ml|cl|dl|l|lt|liter|litre|stk|st|stück|stck|pcs|beutel|btl|pads|kapseln|tabs|tabl|portionen|port)\b\.?',
                    re.IGNORECASE)
PACK_X_RE = re.compile(r'(?<!\d)(\d{1,3})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|lt|stk|st)\b', re.IGNORECASE)
PIECE_UNITS = {'stk', 'st', 'stück', 'stck', 'pcs', 'beutel', 'btl', 'pads', 'kapseln', 'tabs', 'tabl', 'portionen', 'port'}
UNIT_NORM = {'gr': 'g', 'gramm': 'g', 'lt': 'l', 'liter': 'l', 'litre': 'l'}


def s(v):
    return '' if v is None else str(v).strip()


def squeeze(t):
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r'\s+([,.;:!?)])', r'\1', t)
    t = re.sub(r'\(\s+', '(', t)
    t = re.sub(r'[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE0F]', ' ', t)
    t = re.sub(r'(^[\s,;:/\-–|*`´]+|[\s,;:/\-–|*]+$)', '', t)
    t = re.sub(r',\s*,', ',', t)
    return t.strip()


def cap_first(t):
    return t[:1].upper() + t[1:] if t else t


def low_first(t):
    return t[:1].lower() + t[1:] if t else t


def num_norm(n):
    """'1.000' -> '1000', '0.75' -> '0,75', '1,5' -> '1,5'"""
    n = n.replace(' ', '')
    if re.fullmatch(r'\d{1,3}(\.\d{3})+', n):
        return n.replace('.', '')
    return n.replace('.', ',')


def qty_parts(num, unit):
    unit = unit.lower().rstrip('.')
    unit = UNIT_NORM.get(unit, unit)
    num = num_norm(num)
    # 1000 g -> 1 kg, 1000 ml -> 1 l
    if unit == 'g' and re.fullmatch(r'\d+', num) and int(num) >= 1000 and int(num) % 100 == 0:
        num, unit = (str(int(num) // 1000) if int(num) % 1000 == 0 else str(int(num) / 1000).replace('.', ',')), 'kg'
    if unit == 'ml' and re.fullmatch(r'\d+', num) and int(num) >= 1000 and int(num) % 100 == 0:
        num, unit = (str(int(num) // 1000) if int(num) % 1000 == 0 else str(int(num) / 1000).replace('.', ',')), 'l'
    return num, unit


def parse_quantity(qstr, title):
    """-> (quantity_spaced, quantity_compact, pack_count, title_without_qty)"""
    pack = None
    qty_sp = qty_c = ''
    text = title
    src = s(qstr) or ''
    m = PACK_X_RE.search(src) or PACK_X_RE.search(title)
    if m:
        pack = int(m.group(1))
        num, unit = qty_parts(m.group(2), m.group(3))
        if unit in PIECE_UNITS:
            pack = pack * int(float(num.replace(',', '.'))) if re.fullmatch(r'\d+', num) else pack
        else:
            qty_sp, qty_c = f'{num} {unit}', f'{num}{unit}'
        text = PACK_X_RE.sub(' ', text)
    else:
        cands = QTY_RE.findall(src) + QTY_RE.findall(title)
        weight = [(n, u) for n, u in cands if UNIT_NORM.get(u.lower().rstrip('.'), u.lower().rstrip('.')) not in PIECE_UNITS]
        pieces = [(n, u) for n, u in cands if UNIT_NORM.get(u.lower().rstrip('.'), u.lower().rstrip('.')) in PIECE_UNITS]
        if weight:
            num, unit = qty_parts(*weight[0])
            qty_sp, qty_c = f'{num} {unit}', f'{num}{unit}'
        if pieces:
            n = pieces[0][0]
            if re.fullmatch(r'\d+', n):
                pack = int(n)
        text = QTY_RE.sub(' ', text)
    # "(20 Beutel)" / "(3x10 St)" rester
    text = re.sub(r'\(\s*\)', ' ', text)
    text = re.sub(r'\bca\.?\s*$', '', text)
    return qty_sp, qty_c, pack, squeeze(text)


def strip_dots(b):
    b = re.sub(r'(?<=\w)\.(?=\s|$)', '', b)
    b = re.sub(r'(?<=\b[A-Za-z])\.(?=[A-Za-z])', ' ', b)  # Dr.Oetker -> Dr Oetker
    return squeeze(b)


def remove_words(text, pattern):
    if not pattern:
        return text
    return squeeze(re.sub(pattern, ' ', text, flags=re.IGNORECASE))


def remove_phrase(text, phrase):
    if not phrase:
        return text
    return squeeze(re.sub(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', ' ', text, flags=re.IGNORECASE))


def fmt_pct(n):
    n = n.replace('.', ',')
    n = re.sub(r',0$', '', n)
    return n + '%'


def split_variation(rest, L):
    rest = re.sub(L['with_word'], ' ', ' ' + rest + ' ', flags=re.IGNORECASE)  # indlejret "med" fjernes
    rest = re.sub(L['and_words'], '/ ', rest, flags=re.IGNORECASE)
    rest = re.sub(r'\s*,\s*', '/ ', rest)
    rest = re.sub(r'\s*/\s*', '/ ', rest)
    rest = re.sub(r'\.\s*$', '', rest.strip())
    rest = re.sub(r'\s+(verfeinert|hergestellt|zubereitet|abgeschmeckt|angereichert|überzogen|gefüllt)\s*$', '', rest, flags=re.IGNORECASE)
    parts = [x.strip() for x in rest.split('/ ') if x.strip()]
    parts = list(dict.fromkeys(parts))
    parts = [x for x in parts if len(x) > 2 or re.search(r'\d', x)]
    rest = squeeze('/ '.join(parts))
    return rest if L['lang'] == 'de' else low_first(rest)


def find_country(text, L, protected=''):
    """-> (landenavn, tekst uden landeord). Beskytter brandets ord."""
    found = []
    out = text
    prot = set(w.lower() for w in re.findall(r'\w+', protected))
    for adj, land in L['countries'].items():
        pat = r'(?<!\w)' + re.escape(adj) + r'(?:e|er|es|en|em|t)?(?!\w)'
        if adj in prot:
            continue
        if re.search(pat, out, flags=re.IGNORECASE):
            found.append(land)
            out = squeeze(re.sub(pat, ' ', out, flags=re.IGNORECASE))
            out = re.sub(r'\b(nach|art|Art|alla|à la|style|Style)\b\s*$', '', out).strip()
            out = re.sub(r'\bnach\s+Art\b', '', out).strip()
    return ' / '.join(dict.fromkeys(found)), squeeze(out)


def country_from_value(v, L):
    v = s(v)
    if not v:
        return ''
    # "Deutschland Geschmackstyp ..." / "Rotwein - Italien" / "Hergestellt in Frankreich."
    for name in sorted(L['country_names'], key=len, reverse=True):
        if name in ('EU', 'Europäische Union'):
            continue
        if re.search(r'(?<!\w)' + re.escape(name) + r'(?!\w)', v):
            if name == 'Dominikanische Republik' or 'Dominikanische' in v:
                return 'Dominikanische Republik'
            return name
    if re.search(r'Dominikanische', v):
        return 'Dominikanische Republik'
    return ''


WEAK_MEAT = r'(steaks?|roastbeef|hüftsteak|entrecôte|rumpsteak|bolognese|corned beef|schnitzel|wiener|frankfurter|krakauer|salami|lyoner|mortadella|chorizo|nackensteak|kam|bøf\w*|culotte|frikadelle\w*|hamburgerryg|sommergriller|surimi|kaviar|rogn|bacon|speck|graved\w*|eisbein|wild\w*)'


def find_meat(text, L, category=''):
    t = ' ' + text.lower() + ' '
    if re.search(L['veggie_guard'], t):
        return ''
    if re.search(r'ersatz|veggie|vegan|vegetar|alternativ|plante|tofu', (category or '').lower()):
        return ''
    if not re.search(L['meat_cats'], (category or '').lower()):
        t = re.sub(WEAK_MEAT, ' ', t)
    hits = []
    for animal, pat in L['meat'].items():
        if re.search(pat, t):
            hits.append(animal)
    # generisk "Fisch" kun hvis ingen konkret art
    if len(hits) > 1 and 'Fisch' in hits:
        hits.remove('Fisch')
    if len(hits) > 1 and 'Fisk' in hits:
        hits.remove('Fisk')
    if not hits and category and re.search(L['unknown_meat_cats'], category.lower()):
        return L['unknown_meat']
    return ' / '.join(hits[:2])


def find_fat(text, L, product_type='', category=''):
    m = re.search(L['fat'], text, flags=re.IGNORECASE)
    if m:
        return fmt_pct(m.group(1))
    # interval "8-12 %" -> øvre grænse
    m = re.search(r'\d+\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*%\s*(?:fett|fedt)', text, flags=re.IGNORECASE)
    if m:
        return fmt_pct(m.group(1))
    ctx = ' '.join([text, product_type, category]).lower()
    if re.search(r'(^|[^a-zäöüß])(' + L['alcohol_cats'] + r')', (category or '').lower()):
        return ''
    if re.search(L['fat_dairy_words'], ctx):
        m = re.search(r'(?<![\d,.])(\d{1,2}(?:[.,]\d)?)\s*%(?!\s*(?:vol|alk|sugar|fruit|frucht|kakao|cacao|protein|eiwei|säure|zitronens))', text, flags=re.IGNORECASE)
        if m:
            return fmt_pct(m.group(1))
    return ''


def flags_from_text(text, L):
    t = ' ' + text.lower() + ' '
    f = {}
    f['organic'] = bool(re.search(L['organic'], t))
    f['sugar_free'] = bool(re.search(L['sugar_free'], t))
    f['no_added_sugar'] = bool(re.search(L['no_added_sugar'], t))
    f['gluten_free'] = bool(re.search(L['gluten_free'], t))
    f['lactose_free'] = bool(re.search(L['lactose_free'], t))
    f['vegan'] = bool(re.search(L['vegan'], t))
    f['vegetarian'] = bool(re.search(L['vegetarian'], t))
    f['sweeteners'] = bool(re.search(L['sweeteners'], t))
    f['alcohol_free'] = bool(re.search(L['alcohol_free'], t))
    f['frozen'] = bool(re.search(L['frozen'], t))
    return f


def strip_flag_words(text, f, L):
    if f['organic']:
        text = remove_words(text, L['organic_strip'])
    if f['sugar_free']:
        text = remove_words(text, L['sugar_free'])
    if f['no_added_sugar']:
        text = remove_words(text, L['no_added_sugar'])
    if f['gluten_free']:
        text = remove_words(text, L['gluten_free'])
    if f['lactose_free']:
        text = remove_words(text, L['lactose_free'])
    if f['vegan']:
        text = remove_words(text, L['vegan'])
    if f['sweeteners']:
        text = remove_words(text, r'\b(mit|med)\s+' + L['sweeteners'].strip('\\b') if False else L['sweeteners'])
    # "alkoholfri" bliver stående i titlen (Bilka-mønster)
    return squeeze(text)


def build_title(core, qty_c, brand):
    core = squeeze(core)
    core = re.sub(r'(?<=\w)\.(?=\s|$)', '', core)  # bogstav-punktummer væk (m. -> m)
    core = cap_first(core)
    parts = core
    if qty_c:
        parts += f', {qty_c}'
    if brand:
        parts += f' ({brand})'
    return parts


def clean_subtitle(brand, qty_sp, extra=''):
    return ' | '.join([p for p in [brand, qty_sp, extra] if p])


def load_sheet(path, keycol=None):
    ws = openpyxl.load_workbook(path, read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    hdr = [s(h) for h in rows[0]]
    dicts = []
    for r in rows[1:]:
        if r is None or all(v is None for v in r):
            continue
        d = {}
        for i, h in enumerate(hdr):
            if i < len(r) and h and h not in d:
                d[h] = r[i]
        dicts.append(d)
    return hdr, dicts


def try_load(path, keycol):
    try:
        hdr, rows = load_sheet(path)
        return {s(r.get(keycol)): r for r in rows}
    except Exception as ex:  # fx korrupt zip
        print(f'  ! kunne ikke læse {os.path.basename(path)}: {ex.__class__.__name__}: {ex}')
        return {}


RETAILER_LINES = {  # brand -> (Brand, Subbrand, organic)
    'EDEKA Herzstücke': ('EDEKA', 'Herzstücke', False), 'EDEKA Genussmomente': ('EDEKA', 'Genussmomente', False),
    'EDEKA zuhause': ('EDEKA', 'zuhause', False), 'EDEKA Bio': ('EDEKA', '', True),
    'EDEKA Bio+Vegan': ('EDEKA', '', True), 'EDEKA Mein Veggie Tag': ('EDEKA', 'Mein Veggie Tag', False),
    'EDEKA Weinkontor': ('EDEKA', 'Weinkontor', False),
    'REWE Bio': ('REWE', '', True), 'REWE Beste Wahl': ('REWE', 'Beste Wahl', False),
    'REWE Feine Welt': ('REWE', 'Feine Welt', False), 'REWE Regional': ('REWE', 'Regional', False),
    'REWE frei von': ('REWE', 'frei von', False), 'REWE to go': ('REWE', 'to go', False),
    'REWE Bio + vegan': ('REWE', '', True), 'REWE Bio+Vegan': ('REWE', '', True),
    'Bio Wagner': ('Wagner', '', True), 'Alnatura Bio': ('Alnatura', '', True),
}
ALWAYS_ORGANIC_BRANDS = {'alnatura', 'dmbio', 'rewe bio', 'edeka bio', 'biozentrale', 'rapunzel', 'davert', 'allos',
                         'lebensbaum', 'bauck mühle', 'bauck', 'voelkel', 'biovegan', 'demeter', 'naturata',
                         'followfood', 'laselva', 'frusano', 'ppura', 'nucao', 'nu', 'yogi tea', 'pukka', 'sonnentor',
                         'campo verde', 'biorebe', 'bionade', 'alnavit', 'zwergenwiese', 'byodo', 'dennree'}

PET_RE = re.compile(r'\b(hunde|katzen?|katte\w*|futter|futtermittel|dental sticks|kauknochen|hundefutter|katzenfutter|für hunde|für katzen|hundesnack|dyrefoder|hundemad|kattemad|hundefoder|kattefoder|wildvögel|vogelfutter)\b', re.IGNORECASE)


# ----------------------------------------------------------------------------------------------
# Resultat-række
# ----------------------------------------------------------------------------------------------
def new_row():
    return {h: None for h in TARGET}


def finalize(out, core, qty_sp, qty_c, brand, subbrand, pack, ptype, variation, keywords, flags, L,
             extra_sub=''):
    core = squeeze(core)
    core = re.sub(r"^(?:'s|´s|’s)\s+", '', core)
    if ptype:
        land_t, ptype = find_country(ptype, L, protected=brand or '')
        if land_t and not out.get('_is_country_of_origen'):
            out['_is_country_of_origen'] = land_t
    if variation:
        _, variation = find_country(variation, L, protected=brand or '')
    if ptype and ptype.strip().lower() in ('qualität', 'bio', 'premium', 'original', 'classic', 'natur', '-', '', 'abtropfgewicht'):
        ptype = ''
    if not core or len(re.sub(r'\W', '', core)) < 2:
        core = ptype if (ptype and len(ptype) <= 30) else (brand or '')
    out['Brand'] = strip_dots(brand) if brand else None
    out['Subbrand'] = subbrand or None
    out['Quantity'] = qty_sp or None
    out['Pack Count'] = pack or None
    out['Product Type'] = cap_first(squeeze(ptype)) if ptype else None
    out['Variation'] = variation or None
    out['_is_organic'] = 'Yes' if flags.get('organic') else None
    out['_is_sugar_free'] = 'Yes' if flags.get('sugar_free') else None
    out['_is_glutenfree'] = 'Yes' if flags.get('gluten_free') else None
    out['_is_lactose_free'] = 'Yes' if flags.get('lactose_free') else None
    out['_is_vegan'] = 'Yes' if flags.get('vegan') else None
    out['_is_sweeteners'] = 'Yes' if flags.get('sweeteners') else None
    if flags.get('frozen'):
        out['Packaging'] = 'Frozen'
    kws = []
    for k in keywords:
        k = squeeze(re.sub(r'\s+(lt|laut)\.?$', '', squeeze(k)))
        if not k or len(k) > 40:
            continue
        k = cap_first(k)
        if k.lower() not in [x.lower() for x in kws]:
            kws.append(k)
    for i in range(5):
        out[f'Keyword {i + 1}'] = kws[i] if i < len(kws) else None
    out['HelloCal_Title'] = build_title(core, qty_c, out['Brand'])
    out['Product Name'] = out['HelloCal_Title']
    out['Clean Subtitle'] = clean_subtitle(out['Brand'], qty_sp, extra_sub) or None
    return out


def common_attributes(out, title_core, attr_text, L, category, brand, ptype_hint=''):
    """Flag, kød, fedt, land fra titel + attributtekst. Returnerer renset titel-kerne og keywords."""
    flags = flags_from_text(title_core + ' ' + attr_text, L)
    if brand and brand.lower() in ALWAYS_ORGANIC_BRANDS:
        flags['organic'] = True
    if re.search(L['frozen'], (category or '').lower()):
        flags['frozen'] = True
    core = strip_flag_words(title_core, flags, L)
    keywords = []
    if flags['vegetarian'] and not flags['vegan']:
        keywords.append('Vegetarisch' if L['lang'] == 'de' else 'Vegetarisk')
    if flags['no_added_sugar'] and not flags['sugar_free']:
        keywords.append('Ohne Zuckerzusatz' if L['lang'] == 'de' else 'Uden tilsat sukker')
    # land
    land, core = find_country(core, L, protected=brand or '')
    land2, _ = find_country(attr_text, L, protected=brand or '')
    land = land or land2
    # fedt
    fat = find_fat(title_core + ' ' + ptype_hint, L, ptype_hint, category)
    # kød
    meat = find_meat(title_core + ' ' + ptype_hint, L, category)
    # alkohol
    alc_val, alc_pct = '', ''
    m = re.search(L['alcohol_pct'], title_core + ' ' + attr_text, flags=re.IGNORECASE)
    if m:
        alc_pct = fmt_pct(m.group(1))
    cat_l = (category or '').lower()
    if flags['alcohol_free'] or re.search(L['nonalc_cats'], cat_l) or (alc_pct and float(alc_pct.rstrip('%').replace(',', '.')) <= 0.5):
        alc_val = L['alcohol_free_val']
    elif alc_pct or re.search(r'(^|[^a-zäöüß])(' + L['alcohol_cats'] + r')', cat_l):
        alc_val = L['contains_alcohol']
    if alc_pct and fat == alc_pct:
        fat = ''
    out['_is_country_of_origen'] = land or None
    out['_is_fat'] = fat or None
    out['_is_meat'] = meat or None
    out['_is_alcohol'] = alc_val or None
    out['_is_alcohol_pct'] = alc_pct or None
    return core, flags, keywords


def split_type_variation(sentence, L):
    """'Fruchtgummi mit Cola-, Zitronen- und Kirschgeschmack' -> ('Fruchtgummi', 'cola-/ zitronen-/ kirschgeschmack')"""
    sentence = squeeze(sentence)
    sentence = re.split(r'(?<=[a-zäöüß\)%])\.\s+', sentence, maxsplit=1)[0].rstrip('.')
    sentence = re.sub(r'\s+(verfeinert|hergestellt|zubereitet|abgeschmeckt|angereichert)\s*$', '', sentence, flags=re.IGNORECASE)
    m = re.search(L['with_word'], ' ' + sentence + ' ', flags=re.IGNORECASE)
    if m:
        head = (' ' + sentence + ' ')[:m.start()].strip()
        head = re.sub(r'\s+(verfeinert|hergestellt|zubereitet|abgeschmeckt|angereichert|überzogen|gefüllt|gewürzt)\s*$', '', head, flags=re.IGNORECASE)
        rest = (' ' + sentence + ' ')[m.end():].strip()
        return head, split_variation(rest, L)
    return sentence, ''


def pet_status(title, status):
    if PET_RE.search(title or ''):
        return ' | '.join([x for x in [s(status), 'PET_FOOD'] if x])
    return s(status) or None


# ----------------------------------------------------------------------------------------------
# Brand-hjælp (brands som scraperen skar ved første ord)
# ----------------------------------------------------------------------------------------------
GENERIC_NEXT = set('bio h-milch milch haltbare pils weißbier premium original classic natur the der die das mit von aus und '
                   'rotwein weißwein tee kaffee pizza chips sauce soße nudeln reis mix'.split())


def extend_brands(rows, title_key='Original Title', brand_key='Brand'):
    """Hvis næsten alle titler for brand B fortsætter med samme ord X -> brand 'B X'."""
    by_brand = collections.defaultdict(list)
    for r in rows:
        b, t = s(r.get(brand_key)), s(r.get(title_key))
        if b and ' ' not in b and t.lower().startswith(b.lower() + ' '):
            by_brand[b].append(t[len(b) + 1:].split(' ')[0])
    ext = {}
    for b, nexts in by_brand.items():
        if len(nexts) < 2:
            continue
        w, n = collections.Counter(nexts).most_common(1)[0]
        if n / len(nexts) >= 0.8 and w[:1].isupper() and w.lower() not in GENERIC_NEXT and len(w) > 1 \
                and not re.search(r'\d', w) and w.rstrip(',') == w:
            ext[b] = f'{b} {w}'
    return ext


EXPLICIT_BRANDS = {'De': 'De Cecco', 'Oro': 'Oro di Parma', 'Nature': 'Nature Valley', 'Bonne': 'Bonne Maman',
                   'Just': 'Just Spices', 'Hex': 'Hex vom Dasenstein', 'Unsere': 'Unsere Heimat',
                   'Schwip': 'Schwip Schwap', 'Ben\'s': "Ben's Original", 'Bens': "Ben's Original",
                   'Ritter': 'Ritter Sport', 'Red': 'Red Bull', 'Dr.Oetker': 'Dr Oetker', 'Dr. Oetker': 'Dr Oetker',
                   'Mövenpick': 'Mövenpick', 'Funny-Frisch': 'Funny-frisch', 'Bonduelle': 'Bonduelle',
                   'Ortenauer': 'Ortenauer Weinkeller', 'Durbacher': 'Durbacher', 'La': 'La Mole'}


# ----------------------------------------------------------------------------------------------
# EDEKA
# ----------------------------------------------------------------------------------------------
WINE_RE = re.compile(r'^(Rotwein|Weißwein|Weisswein|Roséwein|Rosewein|Rosé|Sekt|Prosecco|Schaumwein|Perlwein|Spirituose|Likör|Whisky|Whiskey|Gin|Rum|Vodka|Wodka|Bier|Glühwein|Wermut|Weinhaltiges Getränk|Fruchtwein|Cidre|Dessertwein|Portwein|Sherry)\s*[-–]\s*([A-ZÄÖÜ][\wäöüß ]+?)(?:\s*[-–/]\s*([\wäöüß/ ]+?))?\s*[.]?\s*(?:Alkoholgehalt.*)?$')


def edeka_type_sentence(addinfo):
    a = squeeze(s(addinfo))
    if not a:
        return '', []
    # første sætning: før " | ", ";", ". " efterfulgt af stort bogstav
    a = re.sub(r'^Abtropfgewicht:?\s*\d+(?:[.,]\d+)?\s*(?:G|g|ML|ml|KG|kg)\.?\s*', '', a)
    a = re.sub(r'^Bio-Qualität\s*\|?\s*', '', a)
    seg = re.split(r'\s*\|\s*|;\s*|(?<=[a-zäöüß\)%])\.\s+(?=[A-ZÄÖÜ])', a, maxsplit=1)[0].strip()
    rest = a[len(seg):]
    others = [x.strip() for x in re.split(r'\s*\|\s*|;\s*|(?<=[a-zäöüß\)%])\.\s+(?=[A-ZÄÖÜ])', rest) if x.strip()]
    return seg, others


MARKETING = re.compile(r'\b(ist|sind|wir|unser\w*|sie|dich|dir|du|ihr\w*|genuss|genießen|perfekt\w*|ideal\w*|lecker\w*|köstlich\w*|herrlich\w*|einfach|schnell|praktisch\w*|wenn|für alle|jeder|dein\w*|verwöhn\w*|freuen|liebe\w*|lust|kommt|sorgt|schmeckt|passt|eignet|garantier\w*)\b|!', re.IGNORECASE)


def convert_edeka(rows, pi):
    ext = extend_brands(rows)
    ext.update(EXPLICIT_BRANDS)
    L = DE
    result = []
    for r in rows:
        out = new_row()
        key = s(r.get('Key'))
        p = pi.get(key, {})
        title = s(r.get('Original Title'))
        out['Original Title'] = title
        out['Subtitle'] = s(r.get('Subtitle')) or None
        out['EAN'] = s(r.get('EAN')) or None
        out['Category'] = s(r.get('Category')) or None
        out['Source URL'] = s(r.get('Source URL')) or None
        out['Manufacturer'] = s(r.get('Manufacturer')) or None
        out['Image File'] = s(r.get('Image File')) or None
        out['Parse Status'] = pet_status(title + ' ' + s(p.get('Additional Product Information'))[:200], r.get('Parse Status'))
        brand = s(r.get('Brand'))
        brand = ext.get(brand, brand)
        # retailer-linjer / subbrand
        subbrand, forced_org = '', False
        for line, (b, sb, org) in RETAILER_LINES.items():
            if brand.lower() == line.lower() or title.lower().startswith(line.lower() + ' '):
                title_brand = line
                brand, subbrand, forced_org = b, sb, org
                break
        else:
            title_brand = brand
        core = title
        if title_brand and core.lower().startswith(title_brand.lower()):
            core = core[len(title_brand):]
        elif brand and core.lower().startswith(brand.lower()):
            core = core[len(brand):]
        core = squeeze(core)
        m_amp = re.match(r"^&\s+([\wäöüß'’.-]+)\s*", core)
        if m_amp and brand:
            brand = f'{brand} & {m_amp.group(1)}'
            core = core[m_amp.end():]
        core = re.sub(r'\s*[-–]\s*Abverkauf\b.*$', '', core, flags=re.IGNORECASE)
        pfand = []
        for w, kw in [('PET', 'PET'), ('EINWEG', 'Einweg'), ('MEHRWEG', 'Mehrweg'), ('Einweg', 'Einweg'), ('Mehrweg', 'Mehrweg'), ('Glas', 'Glas'), ('Dose', 'Dose')]:
            if re.search(r'(?<!\w)' + w + r'(?!\w)', core):
                pfand.append(kw)
                core = remove_phrase(core, w)
        qty_sp, qty_c, pack, core = parse_quantity(r.get('Quantity'), core)
        # produkttype fra første sætning i produktinfo
        addinfo = s(p.get('Additional Product Information'))
        seg, others = edeka_type_sentence(addinfo)
        ptype, variation, keywords = '', '', []
        land_from_info, region = '', ''
        wm = WINE_RE.match(seg)
        if wm:
            ptype = wm.group(1)
            land_from_info = country_from_value(wm.group(2), L) or ''
            region = (wm.group(3) or '').strip()
            if not land_from_info and wm.group(2):
                region = wm.group(2).strip()
            if region:
                keywords.append(region.split('/')[0].strip())
        elif seg and len(seg) <= 70 and not MARKETING.search(seg) and seg[:1].isupper():
            ptype, variation = split_type_variation(seg, L)
            # 'ohne X' -> keyword
            for m in re.finditer(r'\bohne\s+([\wäöüß\- ]+?)(?=,|\.|$|\s+mit\b|\s+und\b|\s+lt\b|\s+laut\b)', ptype, flags=re.IGNORECASE):
                keywords.append('Ohne ' + m.group(1).strip())
            ptype = re.sub(r',?\s*\bohne\s+[\wäöüß\- ]+?(?=,|\.|$|\s+mit\b|\s+und\b|\s+lt\b|\s+laut\b)(?:\s+(?:lt|laut)\.?\s*\w*)?', '', ptype, flags=re.IGNORECASE)
            # procesord adskilt med komma: "Röstkaffee, entkoffeiniert, gemahlen" -> type + keywords
            parts = [x.strip() for x in ptype.split(',') if x.strip()]
            if len(parts) > 1:
                ptype = parts[0]
                for x in parts[1:]:
                    if len(x) <= 30 and not MARKETING.search(x):
                        keywords.append(x)
            ptype = squeeze(re.sub(r'\s*\(.*?\)\s*', ' ', ptype))
            ptype = re.sub(r'\s*(Alkoholgehalt.*|Fruchtgehalt.*)$', '', ptype)
            ptype = re.sub(r'^(Bio|BIO)[- ]?', '', ptype)
            if len(ptype) > 45:
                ptype = ''
        if not ptype:
            cat = s(r.get('Category'))
            if not re.match(r'^(EDEKA|mehr$|Bio-Produkte|Weihnachtszeit|Süß & Salzig|Alkoholfrei$|Schottland|Deutschland|Elkos|Sportnahrung|Nahrungsergänzung)', cat):
                ptype = re.sub(r'\s+von\s+\w+$', '', cat)
        # attributtekst = produktinfo-kolonner
        attr_bits = [addinfo[:400], s(p.get('Alkoholgehalt')), 'Bio' if s(p.get('Bio')).lower() == 'ja' else '',
                     'Fairtrade' if s(p.get('Fairtrade')).lower() == 'ja' else '']
        attr_text = ' '.join(attr_bits)
        core2, flags, kws2 = common_attributes(out, core, attr_text, L, s(r.get('Category')), brand, ptype)
        if forced_org:
            flags['organic'] = True
        if s(p.get('Fairtrade')).lower() == 'ja':
            keywords.append('Fairtrade')
        keywords += kws2 + pfand
        # yderligere korte sætninger -> procesord/keywords
        for o in others[:6]:
            ol = o.lower().rstrip('.')
            if re.search(L['warnings'], ol) or len(o) > 30:
                continue
            if ol in L['process_words'] or re.match(r'^(ohne|mit|aus)\s', ol):
                keywords.append(o.rstrip('.'))
        # land fra kolonner
        land_cols = land_from_info or country_from_value(p.get('Herkunft'), L) or country_from_value(p.get('Country of Origin'), L) \
            or country_from_value(p.get('HERKUNFTSLAND/ANBAUGEBIET'), L) or country_from_value(p.get('LAND/ANBAUGEBIET'), L)
        cat = s(r.get('Category'))
        if not land_cols and cat in ('Schottland', 'Deutschland', 'Irland', 'USA', 'Japan', 'Italien', 'Frankreich', 'Spanien'):
            land_cols = cat
        if land_cols and not out['_is_country_of_origen']:
            out['_is_country_of_origen'] = land_cols
        reg = s(p.get('Region'))
        if reg and reg not in keywords:
            keywords.append(reg)
        # alkoholprocent fra kolonne vinder
        ak = s(p.get('Alkoholgehalt'))
        m = re.search(r'(\d+(?:[.,]\d+)?)', ak)
        if m:
            out['_is_alcohol_pct'] = fmt_pct(m.group(1))
            if float(m.group(1).replace(',', '.')) > 0.5:
                out['_is_alcohol'] = L['contains_alcohol']
            else:
                out['_is_alcohol'] = L['alcohol_free_val']
        # kaffe/te-undertype
        if s(p.get('Kategorien')) and not variation:
            keywords.append(s(p.get('Kategorien')))
        # procesord i titel-kernen fjernes ikke (Bilka beholder dem), men fedt-% / vol-% står også i titlen
        ptype = strip_flag_words(ptype, flags, L)
        ptype = re.sub(r'^(?:[Bb]io(?:-| )?)', '', ptype)
        variation = strip_flag_words(variation, flags, L) if variation else ''
        finalize(out, core2, qty_sp, qty_c, brand, subbrand, pack, ptype, variation, keywords, flags, L)
        result.append(out)
    return result


# ----------------------------------------------------------------------------------------------
# REWE
# ----------------------------------------------------------------------------------------------
BOILER = re.compile(r'im Online-Supermarkt|Lieferung zum Wunschtermin|Jetzt bei REWE|Frisch für dich aus unserer Servicetheke|✔|»')


def rewe_category_type(cat, keywords):
    """'Kirschen im Glas' -> ('Kirschen', +'Glas'); 'Tiefkühl-Spinat' -> ('Spinat', frozen)"""
    frozen = False
    c = cat
    m = re.search(r'\s+(im Glas|in der Dose|aus der Dose|im Beutel|in Dosen|in Gläsern)$', c)
    if m:
        keywords.append({'im Glas': 'Glas', 'in Gläsern': 'Glas', 'im Beutel': 'Beutel'}.get(m.group(1), 'Dose'))
        c = c[:m.start()]
    c = re.sub(r'\s+von der Theke$', '', c)
    if re.search(r'^Tiefkühl-|^TK-|\bTiefkühl\b', c):
        frozen = True
        c = re.sub(r'^Tiefkühl-|^TK-|\s*Tiefkühl\s*', '', c)
    m = re.match(r'^(Frische[rs]?)\s+(.*)$', c)
    if m:
        keywords.append('Frisch')
        c = m.group(2)
    m = re.match(r'^Bio-(.*)$', c)
    organic = False
    if m:
        organic = True
        c = m.group(1)
    # "Weißwein trocken" -> type Weißwein + keyword trocken
    m = re.match(r'^(Rotwein|Weißwein|Roséwein|Sekt|Prosecco)\s+(trocken|halbtrocken|lieblich|süß|feinherb)$', c)
    if m:
        keywords.append(m.group(2))
        c = m.group(1)
    c = re.sub(r'\s*&\s*-\w+', '', c)  # "Sushi & -zutaten" -> Sushi
    return cap_first(squeeze(c)), frozen, organic


REWE_GENERIC_FIRST = set('bio schweine rinder hähnchen kasseler paprika chili dill apfel kräuter rosmarin kartoffeln pizza the thüringer mein meine super black better hackfleisch lammhüfte hähnchenbrustfilet hähnchenspieß jungbullen spitzpaprika speisekartoffeln lamm rind kalb schwein pute ente gans wild fisch lachs forelle garnelen gourmet premium frische frischer frisches original feine feiner feines grüne grüner rote roter gelbe weiße bunte junge sommer winter herbst deutsche deutscher italienische griechische spanische französische mini maxi grosse große kleine knusper zarte zarter hausmacher westfälische bayerische schwäbische fränkische pfälzer norddeutsche vegane veganer veganes vegetarische hot sweet classic natur edel echte echter extra la le hof haus unser unsere'.split())


def guess_rewe_brands(rows):
    cats = set()
    for r in rows:
        for w in re.findall(r'\w+', s(r.get('Category')).lower()):
            cats.add(w)
    firsts = collections.Counter()
    for r in rows:
        if not s(r.get('Brand')):
            w = s(r.get('Original Title')).split(' ')[0]
            firsts[w] += 1
    ok = {}
    for w, n in firsts.items():
        wl = w.lower().strip(',')
        if not w or not w[:1].isupper() or re.search(r'\d', w) or wl in REWE_GENERIC_FIRST or wl in cats:
            continue
        if n >= 2 or re.search(r'[a-z][A-Z]', w) or "'" in w:
            ok[w] = w
    return ok


def convert_rewe(rows, pi, brand_vocab):
    L = DE
    result = []
    guesses = guess_rewe_brands(rows)
    for r in rows:
        out = new_row()
        key = s(r.get('Key'))
        p = pi.get(key, {})
        title = s(r.get('Original Title'))
        out['Original Title'] = title
        out['Subtitle'] = s(r.get('Subtitle')) or None
        out['EAN'] = s(r.get('EAN')) or None
        out['Category'] = s(r.get('Category')) or None
        out['Source URL'] = s(r.get('Source URL')) or None
        out['Manufacturer'] = s(r.get('Manufacturer')) or s(p.get('Kontaktname')) or None
        out['Image File'] = s(r.get('Image File')) or None
        out['Parse Status'] = pet_status(title, r.get('Parse Status'))
        brand = s(r.get('Brand')) or s(p.get('Marke'))
        core = title
        if not brand:
            # prøv brand-vokabular på de første 1-3 ord
            words = title.split(' ')
            for n in (3, 2, 1):
                cand = ' '.join(words[:n])
                if cand.lower() in brand_vocab:
                    brand = brand_vocab[cand.lower()]
                    break
            if not brand and words and words[0] in guesses:
                brand = words[0]
                out['Parse Status'] = ' | '.join([x for x in [s(out['Parse Status']), 'BRAND_GUESS'] if x])
        subbrand, forced_org = '', False
        for line, (b, sb, org) in RETAILER_LINES.items():
            if brand.lower() == line.lower() or title.lower().startswith(line.lower() + ' '):
                if core.lower().startswith(line.lower()):
                    core = core[len(line):]
                brand, subbrand, forced_org = b, sb, org
                break
        else:
            if brand and core.lower().startswith(brand.lower()):
                core = core[len(brand):]
        core = squeeze(core)
        m_amp = re.match(r"^([&+])\s+([\wäöüß'’.-]+)\s*", core)
        if m_amp and brand:
            brand = f'{brand} {m_amp.group(1)} {m_amp.group(2)}'
            core = core[m_amp.end():]
        core = re.sub(r"^(?:'s|´s|`s|’s)\s+", '', core)
        pfand = []
        for w, kw in [('PET', 'PET'), ('EINWEG', 'Einweg'), ('MEHRWEG', 'Mehrweg'), ('Einweg', 'Einweg'), ('Mehrweg', 'Mehrweg')]:
            if re.search(r'(?<!\w)' + w + r'(?!\w)', core):
                pfand.append(kw)
                core = remove_phrase(core, w)
        core = re.sub(r'\bca\.\s*', '', core)
        qty_sp, qty_c, pack, core = parse_quantity(r.get('Quantity'), core)
        if not qty_sp and s(p.get('Nettofüllmenge')):
            qty_sp, qty_c, _, _ = parse_quantity(p.get('Nettofüllmenge'), '')
        if not pack and s(p.get('Anzahl der Portionen pro Packung')):
            pass  # portioner er ikke pakkeantal
        keywords = []
        ptype, frozen_cat, org_cat = rewe_category_type(s(r.get('Category')), keywords)
        # variation fra titel ("mit ...")
        variation = ''
        core_head, variation = split_type_variation(core, L)
        core = core_head if variation else core
        # attributter
        eig = s(p.get('Eigenschaften'))
        addinfo = s(p.get('Additional Product Information'))
        addinfo = '' if BOILER.search(addinfo) and len(addinfo) < 200 else re.sub(r'Zutaten:.*$', '', addinfo)[:300]
        attr_text = ' '.join([eig, addinfo, s(p.get('Alkoholgehalt')), s(p.get('Country of Origin')), s(p.get('Sorte'))])
        core2, flags, kws2 = common_attributes(out, core, attr_text, L, s(r.get('Category')), brand, ptype)
        if forced_org or org_cat or re.search(r'\bBio\b', eig):
            flags['organic'] = True
        if frozen_cat or 'Tiefgefroren' in eig:
            flags['frozen'] = True
        keywords += kws2 + pfand
        for e in [x.strip() for x in eig.split(',') if x.strip()]:
            if e.lower() in ('regional', 'gekühlt', 'tiefpreis', 'vegetarisch') and e not in keywords:
                if e.lower() == 'tiefpreis':
                    continue
                keywords.append(e)
        gt = s(p.get('Geschmackstyp'))
        if gt and gt.lower() != 'sonstiges':
            keywords.append(gt)
        sorte = s(p.get('Sorte'))
        if sorte and not variation and not re.search(r'%', sorte):
            variation = low_first(re.sub(r'^[Mm]it\s+', '', sorte))
        hf = s(p.get('Haltungsform'))
        if hf:
            keywords.append('Haltungsform ' + hf.split(' ')[0])
        # land
        land_cols = country_from_value(p.get('Ursprungsland'), L) or country_from_value(p.get('Ursprung'), L) \
            or country_from_value(p.get('Country of Origin'), L) or country_from_value(p.get('Ort der Erzeugung'), L)
        if land_cols and not out['_is_country_of_origen']:
            out['_is_country_of_origen'] = land_cols
        # alkohol fra kolonner
        ak = s(p.get('Alkoholgehalt')) or ' '.join(re.findall(r'Alkoholgehalt:?\s*\d+(?:[.,]\d+)?\s*%', s(p.get('Country of Origin'))))
        m = re.search(r'(\d+(?:[.,]\d+)?)\s*%', ak)
        if m:
            out['_is_alcohol_pct'] = fmt_pct(m.group(1))
            out['_is_alcohol'] = L['contains_alcohol'] if float(m.group(1).replace(',', '.')) > 0.5 else L['alcohol_free_val']
        ptype = strip_flag_words(ptype, flags, L)
        variation = strip_flag_words(variation, flags, L) if variation else ''
        finalize(out, core2, qty_sp, qty_c, brand, subbrand, pack, ptype, variation, keywords, flags, L)
        result.append(out)
    return result


# ----------------------------------------------------------------------------------------------
# DM
# ----------------------------------------------------------------------------------------------
DM_ATTR_SEG = re.compile(r'^(zuckerfrei|glutenfrei|laktosefrei|vegan|bio|vegetarisch|gefüllt|gesalzen|ungesalzen|geröstet|ungesüßt|gesüßt|ohne zuckerzusatz|msc zertifizierung|msc-zertifiziert|fairtrade|demeter|naturland|koffeinfrei|entkoffeiniert|ready-to-drink|light|zero|einweg|mehrweg)\w*$', re.IGNORECASE)


def convert_dm(rows, pi):
    L = DE
    result = []
    for r in rows:
        out = new_row()
        key = s(r.get('HelloCal_Title'))
        p = pi.get(key, {})
        title = s(r.get('Original Title'))
        out['Original Title'] = title
        out['Subtitle'] = s(r.get('Subtitle')) or None
        out['EAN'] = s(r.get('EAN')) or None
        out['Category'] = s(r.get('Category')).split(' > ')[-1] or None
        out['Source URL'] = s(r.get('Source URL')) or None
        out['Manufacturer'] = s(r.get('Manufacturer')) or None
        out['Image File'] = s(r.get('Image File')) or None
        out['Parse Status'] = pet_status(title, r.get('Parse Status'))
        brand = s(r.get('Brand'))
        subbrand = ''
        keywords, pfand = [], []
        t = title
        for w, kw in [('EINWEG', 'Einweg'), ('MEHRWEG', 'Mehrweg')]:
            if re.search(r'(?<!\w)' + w + r'(?!\w)', t):
                pfand.append(kw)
                t = remove_phrase(t, w)
        # "(20 Beutel)" / "(3x10 St)"
        pack = None
        m = re.search(r'\((\d+)\s*(Beutel|St|Stück|Pads|Kapseln|Tabs|Portionen|Riegel|Tüten)\)', t)
        if m:
            pack = int(m.group(1))
            t = t[:m.start()] + t[m.end():]
        m = re.search(r'\((\d+)\s*[x×]\s*(\d+)\s*(St|Stück|Beutel|g)\)', t)
        if m:
            if m.group(3).lower() != 'g':
                pack = int(m.group(1)) * int(m.group(2))
            t = t[:m.start()] + t[m.end():]
        segs = [x.strip() for x in squeeze(t).split(', ') if x.strip()]
        # sidste segment(er) = mængde
        qty_src = s(r.get('Quantity'))
        while segs and (QTY_RE.fullmatch(segs[-1].rstrip('.')) or re.fullmatch(r'\d+\s*St\.?', segs[-1])):
            last = segs.pop()
            if re.fullmatch(r'\d+\s*St\.?', last):
                pack = pack or int(re.match(r'\d+', last).group(0))
            else:
                qty_src = qty_src or last
        qty_sp, qty_c, pack2, _ = parse_quantity(qty_src, '')
        pack = pack or pack2
        if qty_sp and not pack and re.search(r'\b(\d+)\s*(Beutel|Btl|Tabs|Kapseln|Pads)\b', title):
            pack = int(re.search(r'\b(\d+)\s*(Beutel|Btl|Tabs|Kapseln|Pads)\b', title).group(1))
        ptype = segs[0] if segs else ''
        mids = segs[1:]
        var_parts = []
        for seg in mids:
            seg_c = seg.rstrip('.')
            if DM_ATTR_SEG.match(seg_c):
                keywords.append(seg_c)  # flag-ord fanges via flags senere og fjernes igen
                continue
            if QTY_RE.search(seg_c) and len(seg_c) < 12:
                continue
            var_parts.append(seg_c)
        # type kan selv indeholde "mit"
        ptype_head, var_from_type = split_type_variation(ptype, L)
        ptype = ptype_head
        variation = '/ '.join([x for x in [var_from_type] + list(var_parts) if x])
        variation = split_variation(variation, L) if variation else ''
        # produktegenskaber
        addinfo = s(p.get('Additional Product Information'))
        m = re.search(r'Produkteigenschaften:\s*(.*?)(?:Teesorte:|\s{2,}|(?<=[a-zäöüß])\s+(?=[A-ZÄÖÜ][a-zäöüß]+\s+[a-zäöüß])|$)', addinfo)
        props = []
        for x in (m.group(1) if m else '').split(','):
            mm = re.match(r'^\s*((?:Ohne\s+)?[\wäöüß\-]+)', x)
            if mm:
                props.append(mm.group(1).strip())
        tee = re.search(r'Teesorte:\s*([\wäöüß\- ]+?)(?:\s{2,}|\s(?=[A-ZÄÖÜ])|$)', addinfo)
        attr_text = ' '.join(props + keywords + [addinfo[:200]])
        core = ' '.join([ptype] + var_parts)  # titelkerne = type + variation (dm's titler er "Type, variant, mængde")
        core_title = squeeze(', '.join([x for x in [ptype] + var_parts if x]))
        core2, flags, kws2 = common_attributes(out, core_title, attr_text, L, s(r.get('Category')), brand, ptype)
        keywords = [k for k in keywords if not re.match(L['organic'] + '|' + L['sugar_free'] + '|' + L['gluten_free'] + '|' + L['lactose_free'] + '|' + L['vegan'], ' ' + k.lower() + ' ') and not re.search(L['organic'] + '|' + L['sugar_free'] + '|' + L['gluten_free'] + '|' + L['lactose_free'] + '|' + L['vegan'], ' ' + k.lower() + ' ')]
        keywords += kws2 + pfand
        for pr in props:
            pl = pr.lower()
            if pl.startswith('ohne ') and pr not in keywords:
                keywords.append(pr)
        if tee:
            keywords.append(tee.group(1).strip())
        # fedt fra "Proteinriegel 30%" skal IKKE blive fedt -> guard i find_fat (protein)
        ptype = strip_flag_words(ptype, flags, L)
        variation = strip_flag_words(variation, flags, L) if variation else ''
        # titelkerne: type + variation med komma (dm-form), uden flag-ord
        finalize(out, core2, qty_sp, qty_c, brand, subbrand, pack, ptype, variation, keywords, flags, L)
        result.append(out)
    return result


# ----------------------------------------------------------------------------------------------
# WOLT (dansk)
# ----------------------------------------------------------------------------------------------
NOISE_CODES = {'gs', 'gb', 'fp', 'kk', 'dgf', 'd.g.f', 'dgs', 'ec', 'cdo', 'il', 'san', 'ie', 's.m.', 's.m', 'gb/øg',
               'øg', 'urt.', 'urt', 'first', 'price', 'ml', 'anbrud', 'vægtvare', '-vægtvare'}


def wolt_brand_vocab(extra):
    vocab = {}
    for b in extra:
        if b and len(b) > 1:
            vocab[b.lower()] = b
    return vocab


def smart_case(t):
    """ALLCAPS -> Sætningsform; bevarer tal/enheder og kendte forkortelser."""
    if t != t.upper() or not re.search(r'[A-ZÆØÅ]{3}', t):
        return t
    words = t.lower().split(' ')
    out = []
    for i, w in enumerate(words):
        if re.fullmatch(r'[a-zæøå]{1,2}', w) and i > 0:
            out.append(w)
        elif i == 0 or re.fullmatch(r'[a-zæøå][\w\'\-/.&]*', w) and False:
            out.append(cap_first(w))
        else:
            out.append(w)
    return ' '.join(out)


def convert_wolt(rows, brand_vocab):
    L = DA
    result = []
    for r in rows:
        out = new_row()
        title = s(r.get('Original Title'))
        out['Original Title'] = title
        out['EAN'] = s(r.get('EAN')) or None
        out['Category'] = s(r.get('Category')) or None
        out['Source URL'] = s(r.get('Source URL')) or None
        out['Image File'] = s(r.get('Image File')) or None
        out['Parse Status'] = pet_status(title, r.get('Parse Status'))
        venue = s(r.get('Venue'))
        out['Subtitle'] = venue or None
        brand = s(r.get('Brand'))
        t = title
        keywords = []
        # Wolt Market: "Navn, Brand"
        if venue.startswith('Wolt Market') and ', ' in t:
            head, _, tail = t.rpartition(', ')
            if tail and not QTY_RE.search(tail) and len(tail.split(' ')) <= 3:
                brand = brand or tail.strip()
                t = head
        # Kinesisk købmand: "Navn mængde Brand"
        if venue.startswith('Den Kinesiske'):
            m = QTY_RE.search(t)
            if m and m.end() < len(t):
                tail = t[m.end():].strip()
                if tail and tail[:1].isupper() and len(tail.split(' ')) <= 3 and not QTY_RE.search(tail):
                    brand = brand or tail
                    t = t[:m.end()]
        t = re.sub(r'\s*\((GB|GS|FP|KK|DGS|DGF|ØG)\)', '', t)
        m_fp = re.match(r'^(FIRST PRICE|FIRST PRIC|FIRST|FP)\b\.?\s*', t, flags=re.IGNORECASE)
        if m_fp:
            brand = brand or 'First Price'
            t = t[m_fp.end():]
        m_gb = re.match(r'^(GB/ØG|GB)\b\.?\s*', t)
        if m_gb:
            brand = brand or 'Grøn Balance'
            t = t[m_gb.end():]
        # Meny: koder først i titlen
        words = t.split(' ')
        while words and words[0].lower().rstrip('.') in NOISE_CODES | {w.rstrip('.') for w in NOISE_CODES}:
            words.pop(0)
        t = ' '.join(words)
        # brand fra vokabular (første 1-3 ord)
        if not brand:
            ws_ = t.split(' ')
            for n in (3, 2, 1):
                cand = ' '.join(ws_[:n]).strip(',')
                if cand.lower() in brand_vocab:
                    brand = brand_vocab[cand.lower()]
                    t = ' '.join(ws_[n:])
                    break
        else:
            if t.lower().startswith(brand.lower() + ' '):
                t = t[len(brand) + 1:]
        t = squeeze(t)
        qty_sp, qty_c, pack, core = parse_quantity(r.get('Quantity'), t)
        core = re.sub(r'\b(SF|sf)\b$', 'sukkerfri', core)
        core = smart_case(core)
        core_head, variation = split_type_variation(core, L)
        core_tv = core_head if variation else core
        core2, flags, kws2 = common_attributes(out, core_tv, '', L, '', brand, core_head)
        keywords += kws2
        if re.search(r'\bvægtvare\b', title, flags=re.IGNORECASE):
            keywords.append('Vægtvare')
            core2 = remove_words(core2, r'-?\s*vægtvare')
        ptype = strip_flag_words(core_head, flags, L)
        ptype = re.sub(r'\s+\d+(?:[.,]\d+)?\s*%.*$', '', ptype)  # "10%" ud af typen (står i _is_fat)
        ptype = re.sub(r'\s+\d+\+$', '', ptype)
        land, ptype = find_country(ptype, L, brand)
        if brand and brand.lower() in ALWAYS_ORGANIC_BRANDS | {'aarstiderne', 'änglamark', 'grøn balance', 'naturli', 'urtekram', 'hanegal', 'thise', 'øllingegaard', 'naturmælk'}:
            flags['organic'] = True
        finalize(out, core2, qty_sp, qty_c, brand, '', pack, ptype, variation, keywords, flags, L, extra_sub='')
        result.append(out)
    return result


# ----------------------------------------------------------------------------------------------
# Skriv + rapport
# ----------------------------------------------------------------------------------------------
def write_xlsx(path, rows):
    rows = sorted(rows, key=lambda r: (s(r['Product Type']).lower() or '￿', s(r['HelloCal_Title']).lower()))
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Products'
    ws.append(HEADER_OUT)
    for r in rows:
        ws.append([r[h] for h in TARGET])
    for i, h in enumerate(HEADER_OUT, 1):
        ws.column_dimensions[get_column_letter(i)].width = 14 if h.startswith('_') else 28
    ws.freeze_panes = 'A2'
    wb.save(path)
    return rows


def stats(rows):
    st = collections.OrderedDict()
    for h in ['Brand', 'Subbrand', 'Pack Count', 'Product Type', 'Variation', 'Packaging', '_is_alcohol', '_is_alcohol_pct',
              '_is_country_of_origen', '_is_organic', '_is_glutenfree', '_is_lactose_free', '_is_vegan', '_is_sweeteners',
              '_is_sugar_free', '_is_meat', '_is_fat', 'Keyword 1', 'Quantity']:
        st[h] = sum(1 for r in rows if r[h])
    return st


def before_after(orig_rows, new_rows, key, n=10, seed=11):
    random.seed(seed)
    by_title = {s(r['Original Title']): r for r in new_rows}
    picks = random.sample(orig_rows, min(n * 6, len(orig_rows)))
    lines = []
    shown = 0
    for o in picks:
        nw = by_title.get(s(o.get('Original Title')))
        if not nw:
            continue
        filled = [h for h in ['Subbrand', 'Pack Count', 'Variation', 'Packaging', '_is_alcohol', '_is_alcohol_pct', '_is_country_of_origen',
                              '_is_organic', '_is_glutenfree', '_is_lactose_free', '_is_vegan', '_is_sweeteners', '_is_sugar_free', '_is_meat', '_is_fat'] if nw[h]]
        if len(filled) < 2 and shown >= n // 2:
            continue
        lines.append(f"\n**Før:** `{s(o.get('Original Title'))}` | Brand `{s(o.get('Brand'))}` | Qty `{s(o.get('Quantity'))}` | Type `{s(o.get('Product Type'))}` | KW `{s(o.get('Keyword 1'))}, {s(o.get('Keyword 2'))}, {s(o.get('Keyword 3'))}`")
        after = [f"Titel `{nw['HelloCal_Title']}`", f"Brand `{s(nw['Brand'])}`", f"Qty `{s(nw['Quantity'])}`", f"Type `{s(nw['Product Type'])}`"]
        for h in ['Subbrand', 'Pack Count', 'Variation', 'Packaging', '_is_alcohol', '_is_alcohol_pct', '_is_country_of_origen', '_is_organic',
                  '_is_glutenfree', '_is_lactose_free', '_is_vegan', '_is_sweeteners', '_is_sugar_free', '_is_meat', '_is_fat']:
            if nw[h]:
                after.append(f"{h if h != '_is_alcohol_pct' else '_is_alcohol (%)'} `{nw[h]}`")
        kws = [s(nw[f'Keyword {i}']) for i in range(1, 6) if nw[f'Keyword {i}']]
        if kws:
            after.append('KW `' + ', '.join(kws) + '`')
        lines.append('**Efter:** ' + ' | '.join(after))
        shown += 1
        if shown >= n:
            break
    return '\n'.join(lines)


def main(stores):
    report = ['# Omlægning af ark til Bilka-layout\n', 'Kørt med `omlaeg_ark.py`. Originalarkene er urørte; nye ark hedder `<butik>_ny.xlsx` (35 kolonner som bilka.xlsx, sorteret på Product Type).\n']
    # brand-vokabular fra alle ark
    vocab = {}
    for f in ['bilka.xlsx', 'spar.xlsx', 'rema1000.xlsx', 'aarstiderne.xlsx', 'edeka.xlsx', 'rewe.xlsx', 'dm.xlsx']:
        try:
            _, rr = load_sheet(os.path.join(HERE, f))
            for r in rr:
                b = s(r.get('Brand'))
                if b and len(b) > 2 and ' ' in b or (b and len(b) > 3):
                    vocab.setdefault(b.lower(), strip_dots(b))
        except Exception as ex:
            print('  ! brand-vokabular', f, ex)
    for bad in ['bio', 'de', 'la', 'le', 'the', 'more', 'nature', 'just', 'nu', 'hex', 'oro', 'bonne', 'unsere', 'schwip', 'mein', 'meine', 'super', 'black', 'better', 'pizza', 'paprika', 'chili', 'dill', 'apfel', 'kräuter', 'rosmarin', 'hof', 'schloss', 'gourmet', 'frisk', 'friske', 'thai', 'kinesisk', 'svampe', 'hvid', 'mørk', 'snack', 'ekstra', 'instant', 'sweet', 'ost', 'pasta', 'skyr', 'yoghurt', 'chokolade', 'revet', 'danbo', 'extra', 'original', 'first', 'price', 'øko', 'bbq', 'premium', 'classic', 'light', 'fresh']:
        vocab.pop(bad, None)
    for b in ['Gestus', 'First Price', 'Grøn Balance', 'Kims', 'Rynkeby', 'Pålækker', 'Hansens', 'Ritter Sport', 'Knorr', 'Mill', 'Wasa',
              'Gøl', 'Spicefield', 'Naturli', 'Schär', 'Svansø', "L'Or", 'Lor', 'Aarstiderne', 'Beauvais', 'Steff-H', 'Easis', 'Katjes',
              'Egekilde', 'Castus', 'Lavazza', 'Omhu', 'Rana', 'Fredsted', 'Banderos', 'Arla', 'Ga-Jol', 'Tulip', 'Oatly', 'Haribo',
              'Pickwick', 'Aqua Ice', 'Booster', 'Marabou', 'Oetker', 'Dr Oetker', 'Toms', 'Cocio', 'Harboe', 'Dava', 'State',
              'Rosenborg', 'Glyngøre', 'Hanegal', 'Cardenau', 'De Cecco', 'Møn', 'Ricola', 'Reduced', 'Monster', 'Monster Ultra',
              'Capri-Sun', 'Oreo', 'Cheasy', 'Galbani', "McVitie's", 'Arla Klovborg', 'Schulstad', 'Arla Karolines Køkken', 'Lambi',
              'Santa Maria', 'La Mole', 'Depanneur', 'Tuborg', 'Faxe', 'Pepsi', 'Afri', 'Crispy', 'Coca-Cola', 'Carlsberg', 'Thise',
              'Änglamark', 'Urtekram', 'Lays', 'Pringles', 'Nescafé', 'Nescafe', 'Gevalia', 'Merrild', 'BKI', 'Kelloggs', "Kellogg's",
              'Barilla', 'Heinz', 'Hellmanns', "Hellmann's", 'Maggi', 'Lurpak', 'Kærgården', 'Puck', 'Castello', 'Buko', 'Philadelphia',
              'Lätta', 'Becel', 'Ben & Jerrys', "Ben & Jerry's", 'Magnum', 'Premier Is', 'Frisko', 'Hatting', 'Kohberg', 'Pågen',
              'Schulstad', 'Stryhns', 'Graasten', 'K-Salat', 'Steff Houlberg', '3-Stjernet', 'Tulip', 'Gøl', 'Danish Crown', 'Friland',
              'Løgismose', 'Meyers', 'Emmerys', 'Lagkagehuset', 'Rema', 'Nemlig', 'Samyang', 'Binggrae', 'Jongga', "O'Food", 'Tilda',
              'Sundelic', 'Mitrofresh', 'MaoXiong', 'Yong Jia', 'Gourmet Family', 'NVF', 'Governer', 'Nin Jiom', 'Yakult', 'Lee Kum Kee',
              'Kikkoman', 'Nissin', 'Nongshim', 'Ottogi', 'CJ', 'Bibigo', 'Pulmuone', 'Lotte', 'Pocky', 'Glico', 'Calbee', 'Meiji', 'Morinaga']:
        vocab[b.lower()] = b
    all_new = {}
    if 'edeka' in stores:
        print('EDEKA ...')
        _, rows = load_sheet(os.path.join(HERE, 'edeka.xlsx'))
        pi = try_load(os.path.join(HERE, 'edeka_product_information.xlsx'), 'Key')
        new = convert_edeka(rows, pi)
        new = write_xlsx(os.path.join(HERE, 'edeka_ny.xlsx'), new)
        all_new['edeka'] = (rows, new)
    if 'rewe' in stores:
        print('REWE ...')
        _, rows = load_sheet(os.path.join(HERE, 'rewe.xlsx'))
        pi = try_load(os.path.join(HERE, 'rewe_product_information.xlsx'), 'Key')
        new = convert_rewe(rows, pi, vocab)
        new = write_xlsx(os.path.join(HERE, 'rewe_ny.xlsx'), new)
        all_new['rewe'] = (rows, new)
    if 'dm' in stores:
        print('DM ...')
        _, rows = load_sheet(os.path.join(HERE, 'dm.xlsx'))
        pi = try_load(os.path.join(HERE, 'dm_product_information.xlsx'), 'HelloCal_Title')
        new = convert_dm(rows, pi)
        new = write_xlsx(os.path.join(HERE, 'dm_ny.xlsx'), new)
        all_new['dm'] = (rows, new)
    if 'wolt' in stores:
        print('WOLT ...')
        _, rows = load_sheet(os.path.join(HERE, 'wolt.xlsx'))
        new = convert_wolt(rows, vocab)
        new = write_xlsx(os.path.join(HERE, 'wolt_ny.xlsx'), new)
        all_new['wolt'] = (rows, new)
    for store, (rows, new) in all_new.items():
        st = stats(new)
        report.append(f'\n## {store.upper()} — {len(new)} rækker\n')
        report.append('Udfyldte felter: ' + ', '.join(f'{k} {v}' for k, v in st.items()) + '\n')
        report.append('### Før / efter (tilfældige rækker)\n')
        report.append(before_after(rows, new, 'Original Title'))
        report.append('')
    with open(os.path.join(HERE, 'Omlaegning_rapport.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(report))
    print('\n'.join(report))


if __name__ == '__main__':
    stores = [a.lower() for a in sys.argv[1:]] or ['edeka', 'rewe', 'dm', 'wolt']
    main(stores)
