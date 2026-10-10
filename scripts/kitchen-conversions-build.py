# Bygger src/data/kitchen-conversions.json — omregningstabellen væsker → gram
# (Viden om mad → Omregning, og Mål/Gram-skiftet på retter). Ret tallene her
# og kør: python3 scripts/kitchen-conversions-build.py
import json, os
# (navn, g pr. dl, nøgleord) pr. gruppe. Massefylder: FAO/INFOODS Density
# Database v2 og USDA-mål, afrundet til hele gram pr. dl; tørvarer: danske
# køkkenmål (løst fyldt, strøget dl-mål).
G = [
 ("vand", "Vand, kaffe og te", [
  ("Vand (postevand, mineralvand, danskvand)", 100, ["vand","postevand","mineralvand","danskvand","kildevand","isvand","kogende vand","koldt vand","lunkent vand","sodavandsvand"]),
  ("Kaffe (brygget)", 100, ["kaffe","espresso","filterkaffe"]),
  ("Te (brygget)", 100, ["te","iste usødet"]),
 ]),
 ("maelk", "Mælk og mælkeprodukter", [
  ("Sødmælk", 103, ["sødmælk","mælk","kogemælk"]),
  ("Letmælk", 103, ["letmælk"]),
  ("Minimælk", 103, ["minimælk"]),
  ("Skummetmælk", 104, ["skummetmælk"]),
  ("Kærnemælk", 103, ["kærnemælk"]),
  ("Kakaomælk", 106, ["kakaomælk","cacaomælk","chokolademælk","cacaoskummetmælk"]),
  ("Gedemælk", 103, ["gedemælk"]),
  ("Kefir", 103, ["kefir","letmælkskefir"]),
  ("Valle", 102, ["valle"]),
  ("Modermælk", 103, ["modermælk"]),
  ("Milkshake", 105, ["milkshake"]),
  ("Sødet kondenseret mælk", 130, ["kondenseret mælk","sødet kondenseret mælk","kondensmælk"]),
 ]),
 ("flode", "Fløde, yoghurt og syrnet", [
  ("Piskefløde 38 %", 99, ["piskefløde","fløde 38","flødeskum"]),
  ("Madlavningsfløde 13-18 %", 101, ["madlavningsfløde","fløde","fløde 18","fløde 13","fløde 15"]),
  ("Kaffefløde 9 %", 102, ["kaffefløde","fløde 9"]),
  ("Creme fraiche 38 %", 99, ["creme fraiche 38","cremefraiche 38","crème fraîche 38"]),
  ("Creme fraiche 18 %", 102, ["creme fraiche","cremefraiche","crème fraîche","creme fraiche 18"]),
  ("Creme fraiche 9 % / fraiche", 104, ["creme fraiche 9","fraiche 9","syrnet fløde"]),
  ("Yoghurt naturel", 104, ["yoghurt","yoghurt naturel","drikkeyoghurt"]),
  ("Græsk / tyrkisk yoghurt", 105, ["græsk yoghurt","tyrkisk yoghurt","flødeyoghurt"]),
  ("Skyr", 106, ["skyr"]),
  ("Ymer, ylette og tykmælk", 104, ["ymer","ylette","tykmælk","a38"]),
  ("Koldskål", 104, ["koldskål"]),
 ]),
 ("plante", "Plantedrikke", [
  ("Havredrik", 103, ["havredrik","havremælk","havrefløde"]),
  ("Sojadrik", 103, ["sojadrik","sojamælk"]),
  ("Mandeldrik", 102, ["mandeldrik","mandelmælk"]),
  ("Risdrik", 103, ["risdrik","rismælk"]),
  ("Kokosmælk", 98, ["kokosmælk","kokosdrik"]),
  ("Kokosfløde", 99, ["kokosfløde","kokoscreme"]),
 ]),
 ("juice", "Juice, saft og sodavand", [
  ("Appelsinjuice", 104, ["appelsinjuice","appelsinsaft","appelsin juice"]),
  ("Æblejuice / æblemost", 105, ["æblejuice","æblemost","æblesaft"]),
  ("Ananasjuice", 105, ["ananasjuice","ananassaft"]),
  ("Druesaft / druejuice", 106, ["druesaft","druejuice"]),
  ("Grapefrugtjuice", 104, ["grapefrugtjuice","grapejuice"]),
  ("Tomatjuice", 103, ["tomatjuice"]),
  ("Gulerodsjuice", 103, ["gulerodsjuice"]),
  ("Grøntsagsjuice", 103, ["grøntsagsjuice"]),
  ("Sveskejuice", 107, ["sveskejuice"]),
  ("Citron- og limesaft", 103, ["citronsaft","citronjuice","limesaft","limejuice"]),
  ("Smoothie", 105, ["smoothie"]),
  ("Frugtnektar", 105, ["nektar","frugtnektar"]),
  ("Saft, koncentreret (sød)", 123, ["saft","hyldeblomstsaft","hyldebærsaft","solbærsaft","hindbærsaft","jordbærsaft","kirsebærsaft","ribssaft","hybensaft","rabarbersaft","koncentreret saft","sød saft"]),
  ("Saft, koncentreret (sur, usødet)", 103, ["sur saft","usødet saft"]),
  ("Saftevand (drikkeklar)", 103, ["saftevand"]),
  ("Sodavand med sukker", 104, ["sodavand","cola","appelsinvand","citronvand","lemonade","limonade","tonic","ginger ale","ginger beer"]),
  ("Sodavand uden sukker (light)", 100, ["light sodavand","sukkerfri sodavand","sodavand light","cola light","cola zero"]),
  ("Energidrik med sukker", 104, ["energidrik","energidrink"]),
  ("Energidrik uden sukker", 100, ["sukkerfri energidrik","energidrik sukkerfri"]),
  ("Iste med sukker", 103, ["iste","ice tea"]),
 ]),
 ("olie", "Olie og flydende fedt", [
  ("Olivenolie", 91, ["olivenolie","jomfruolivenolie","olivenolie ekstra jomfru"]),
  ("Rapsolie", 92, ["rapsolie","koldpresset rapsolie"]),
  ("Solsikkeolie", 92, ["solsikkeolie"]),
  ("Sesamolie", 92, ["sesamolie","ristet sesamolie"]),
  ("Majsolie", 92, ["majsolie","majskimolie"]),
  ("Sojaolie", 92, ["sojaolie"]),
  ("Jordnøddeolie", 91, ["jordnøddeolie"]),
  ("Hørfrøolie", 93, ["hørfrøolie"]),
  ("Valnøddeolie", 92, ["valnøddeolie"]),
  ("Vindruekerneolie", 92, ["vindruekerneolie","druekerneolie"]),
  ("Tidselolie", 92, ["tidselolie","safflorolie"]),
  ("Hvedekimolie", 92, ["hvedekimolie"]),
  ("Bomuldsfrøolie", 92, ["bomuldsfrøolie"]),
  ("Avocadoolie", 91, ["avocadoolie"]),
  ("Kokosolie (smeltet)", 92, ["kokosolie","kokosfedt"]),
  ("Palmeolie (smeltet)", 89, ["palmeolie","palmekerneolie"]),
  ("Fiskeolie / levertran", 92, ["fiskeolie","levertran","torskelevertran"]),
  ("Olie, neutral (madolie)", 92, ["olie","madolie","neutral olie","vegetabilsk olie","stegeolie","fritureolie"]),
  ("Smør, smeltet", 91, ["smeltet smør","smør smeltet","klaret smør","ghee"]),
  ("Andefedt, gåsefedt og svinefedt (smeltet)", 90, ["andefedt","gåsefedt","svinefedt","grisefedt","oksetalg"]),
 ]),
 ("alkohol", "Øl, vin og spiritus", [
  ("Øl (pilsner, lager, ale)", 101, ["øl","pilsner","lagerøl","guldøl","ale","hvedeøl","julebryg","påskebryg","ipa"]),
  ("Øl, alkoholfri", 102, ["alkoholfri øl","pilsner alkoholfri","alkoholfri pilsner"]),
  ("Porter / stout", 102, ["porter","stout"]),
  ("Hvidtøl / maltøl", 104, ["hvidtøl","maltøl","nisseøl"]),
  ("Rødvin", 99, ["rødvin","vin"]),
  ("Hvidvin, tør", 99, ["hvidvin","tør hvidvin"]),
  ("Hvidvin, sød / dessertvin", 102, ["sød hvidvin","dessertvin"]),
  ("Rosévin", 99, ["rosévin","rosevin"]),
  ("Mousserende vin", 99, ["champagne","cava","prosecco","mousserende vin","crémant","cremant","asti"]),
  ("Vin, alkoholfri", 102, ["alkoholfri vin","alkoholfri rødvin","alkoholfri hvidvin","alkoholfri rosévin"]),
  ("Hedvin (portvin, sherry, madeira)", 102, ["portvin","sherry","madeira","hedvin","marsala"]),
  ("Vermouth", 102, ["vermouth","vermut"]),
  ("Cider", 102, ["cider","æblecider","pærecider"]),
  ("Spiritus 40 % (vodka, gin, rom, whisky)", 95, ["spiritus","vodka","gin","rom","whisky","whiskey","cognac","brandy","snaps","akvavit","tequila","calvados"]),
  ("Likør", 108, ["likør","kaffelikør","amaretto","curacao","limoncello","fløde likør","flødelikør"]),
  ("Bitter (Campari o.l.)", 104, ["bitter","campari","aperol"]),
 ]),
 ("sodt", "Honning og sirup", [
  ("Honning (flydende)", 142, ["honning","akaciehonning","flydende honning"]),
  ("Lys sirup", 140, ["sirup","lys sirup"]),
  ("Mørk sirup", 140, ["mørk sirup"]),
  ("Ahornsirup", 132, ["ahornsirup","maple syrup"]),
  ("Agavesirup", 135, ["agavesirup","agave sirup"]),
  ("Glukosesirup", 143, ["glukosesirup","glucosesirup"]),
  ("Melasse", 140, ["melasse"]),
 ]),
 ("sauce", "Saucer, eddike og bouillon", [
  ("Sojasauce", 115, ["sojasauce","soja","soyasauce","soya","tamari"]),
  ("Fiskesauce", 120, ["fiskesauce"]),
  ("Østerssauce", 120, ["østerssauce"]),
  ("Eddike (husholdnings-, vin- og æbleeddike)", 101, ["eddike","vineddike","æbleeddike","hvidvinseddike","rødvinseddike","lageeddike","risvinseddike","riseddike","husholdningseddike"]),
  ("Balsamico", 110, ["balsamico","balsamicoeddike","balsamicoeddike"]),
  ("Bouillon og fond", 100, ["bouillon","fond","hønsebouillon","oksebouillon","grøntsagsbouillon","kyllingefond","kalvefond"]),
  ("Suppe", 103, ["suppe","tomatsuppe","aspargessuppe","karrysuppe"]),
  ("Passata / hakkede tomater", 103, ["passata","hakkede tomater","flåede tomater","tomatpassata"]),
  ("Ketchup", 115, ["ketchup"]),
  ("BBQ-sauce", 110, ["bbq-sauce","bbq sauce","barbecuesauce"]),
  ("Sennep", 105, ["sennep","dijonsennep","grov sennep"]),
  ("Mayonnaise og remoulade", 95, ["mayonnaise","remoulade","aioli"]),
  ("Dressing", 100, ["dressing","salatdressing","vinaigrette"]),
 ]),
 ("aeg", "Æg (flydende)", [
  ("Hele æg (pisket)", 103, ["æg","sammenpisket æg","pasteuriseret æg","hele æg"]),
  ("Æggehvide", 103, ["æggehvide"]),
  ("Æggeblomme", 104, ["æggeblomme"]),
 ]),
 ("torvarer", "Tørvarer målt i dl", [
  ("Hvedemel", 60, ["hvedemel","mel","tipo 00","manitobamel","durummel"]),
  ("Fuldkornshvedemel / grahamsmel", 55, ["fuldkornshvedemel","grahamsmel","fuldkornsmel"]),
  ("Rugmel", 55, ["rugmel","fuldkornsrugmel"]),
  ("Speltmel", 55, ["speltmel","fuldkornsspeltmel"]),
  ("Kartoffelmel", 70, ["kartoffelmel"]),
  ("Majsstivelse", 55, ["majsstivelse","maizena"]),
  ("Sukker", 85, ["sukker","rørsukker","stødt melis","perlesukker"]),
  ("Flormelis", 50, ["flormelis"]),
  ("Brun farin", 70, ["brun farin","farin","brunt sukker","brunt rørsukker"]),
  ("Havregryn", 35, ["havregryn","grovvalsede havregryn","finvalsede havregryn"]),
  ("Ris (rå)", 85, ["ris","jasminris","basmatiris","risottoris","grødris","fuldkornsris"]),
  ("Couscous", 75, ["couscous"]),
  ("Bulgur", 80, ["bulgur"]),
  ("Quinoa", 85, ["quinoa"]),
  ("Linser (tørrede)", 85, ["linser","røde linser","grønne linser","beluga linser"]),
  ("Kakaopulver", 40, ["kakao","kakaopulver"]),
  ("Salt (fint)", 120, ["salt","bordsalt","fint salt","havsalt"]),
  ("Bagepulver", 80, ["bagepulver"]),
  ("Natron", 90, ["natron"]),
  ("Revet ost", 40, ["revet ost","revet parmesan"]),
  ("Kokosmel", 35, ["kokosmel"]),
  ("Mandelmel", 45, ["mandelmel"]),
  ("Rasp / paneermel", 45, ["rasp","paneermel","panko"]),
  ("Rosiner", 65, ["rosiner"]),
  ("Hakkede nødder", 55, ["hakkede nødder","hakkede mandler","hakkede hasselnødder"]),
  ("Sesamfrø", 65, ["sesamfrø","sesam"]),
 ]),
]
import re, unicodedata
def slug(s):
    s=s.lower().replace("æ","ae").replace("ø","oe").replace("å","aa")
    s=unicodedata.normalize("NFKD",s).encode("ascii","ignore").decode()
    return re.sub(r"[^a-z0-9]+","-",s).strip("-")
groups=[]; items=[]; seen=set()
for gid,title,rows in G:
    groups.append({"id":gid,"title":title})
    for name,gpd,kw in rows:
        i=slug(name.split(" (")[0].split(" /")[0])
        while i in seen: i+="-2"
        seen.add(i)
        items.append({"id":i,"group":gid,"name":name,"gramsPerDl":gpd,"keywords":sorted(set(k.lower() for k in kw))})
# Dubletter af nøgleord på tværs giver tvetydige match.
from collections import Counter
c=Counter(k for it in items for k in it["keywords"])
d=[k for k,v in c.items() if v>1]
assert not d, d
json.dump({"groups":groups,"items":items},open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","src","data","kitchen-conversions.json"),"w"),ensure_ascii=False,indent=1)
print(len(items))
