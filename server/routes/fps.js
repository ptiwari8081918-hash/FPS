const r = require('express').Router();
const c = require('../controllers/fpsController');
const axios = require('axios');
const Shop = require('../models/Shop');
const { requireAuth } = require('../middleware/auth');
const { requireOwnShop } = require('../middleware/roles');

// Complete official 75 districts of Uttar Pradesh
const UP_DISTRICTS = [
  'AGRA', 'ALIGARH', 'AMBEDKAR NAGAR', 'AMETHI', 'AMROHA', 'AURAIYA', 'AYODHYA',
  'AZAMGARH', 'BAGHPAT', 'BAHRAICH', 'BALLIA', 'BALRAMPUR', 'BANDA', 'BARABANKI',
  'BAREILLY', 'BASTI', 'BHADOHI', 'BIJNOR', 'BUDAUN', 'BULANDSHAHR', 'CHANDAULI',
  'CHITRAKOOT', 'DEORIA', 'ETAH', 'ETAWAH', 'FARRUKHABAD', 'FATEHPUR', 'FIROZABAD',
  'GAUTAM BUDDHA NAGAR', 'GHAZIABAD', 'GHAZIPUR', 'GONDA', 'GORAKHPUR', 'HAMIRPUR',
  'HAPUR', 'HARDOI', 'HATHRAS', 'JALAUN', 'JAUNPUR', 'JHANSI', 'KANNAUJ',
  'KANPUR DEHAT', 'KANPUR NAGAR', 'KASGANJ', 'KAUSHAMBI', 'KHERI', 'KUSHINAGAR',
  'LALITPUR', 'LUCKNOW', 'MAHARAJGANJ', 'MAHOBA', 'MAINPURI', 'MATHURA', 'MAU',
  'MEERUT', 'MIRZAPUR', 'MORADABAD', 'MUZAFFARNAGAR', 'PILIBHIT', 'PRATAPGARH',
  'PRAYAGRAJ', 'RAE BARELI', 'RAMPUR', 'SAHARANPUR', 'SAMBHAL', 'SANT KABIR NAGAR',
  'SHAHJAHANPUR', 'SHAMLI', 'SHRAVASTI', 'SIDDHARTHNAGAR', 'SITAPUR', 'SONBHADRA',
  'SULTANPUR', 'UNNAO', 'VARANASI'
];

// Fallback blocks/tehsils for UP districts
const UP_TEHSILS = {
  'AGRA': ['ACHHNERA', 'AGRA', 'AKOLA', 'BAH', 'BARAULI AHIR', 'BICHPURI', 'ETMADPUR', 'FATEHABAD', 'FATEHPUR SIKRI', 'JAGNER', 'JAITPUR KALAN', 'KHANDAULI', 'KHERAGARH', 'KIRAOLI', 'PINAHAT', 'SAIYAN', 'SHAMSABAD'],
  'ALIGARH': ['ALIGARH', 'ATRAULI', 'BIJAULI', 'CHANDAUS', 'DHANI PUR', 'GABHANA', 'IGLAS', 'JAWAN', 'KHAIR', 'LODHA', 'TAPPAL'],
  'AMBEDKAR NAGAR': ['AKBARPUR', 'ALLAPUR', 'BHITI', 'JALALPUR', 'KATEHARI', 'TANDA'],
  'AMETHI': ['AMETHI', 'GAURI GANJ', 'JAGDISHPUR', 'MUSAFIRKHANA', 'SHUKLA BAZAR', 'TILOI'],
  'AMROHA': ['AMROHA', 'DHANAURA', 'HASANPUR', 'JOYA', 'NAUGAWAN SADAT'],
  'AURAIYA': ['ACHHALDA', 'AJITMAL', 'AURAIYA', 'BHAGYANAGAR', 'BIDHUNA', 'SAHAR'],
  'AYODHYA': ['BIKAPUR', 'HARINGTONGANJ', 'MILKIPUR', 'PURA BAZAR', 'RUDAULI', 'SOHAWAL', 'TARUN'],
  'AZAMGARH': ['AZAMGARH', 'BILARIAGANJ', 'BURHANPUR', 'JAHANAGANJ', 'LALGANJ', 'MEHNAGAR', 'PHULPUR', 'SAGRI'],
  'BAGHPAT': ['BAGHPAT', 'BARAUT', 'CHHAPRAULI', 'KHEKRA', 'PILANA'],
  'BAHRAICH': ['BAHRAICH', 'HUZOORPUR', 'JARWAL', 'KAISERGANJ', 'MAHASI', 'MIHINPURWA', 'NANPARA', 'PAYAGPUR'],
  'BALLIA': ['BAIRIYA', 'BALLIA', 'BANSDEEH', 'BELHARI', 'DUBHAR', 'HANUMANGANJ', 'MANIAR', 'RASRA', 'SOHAWAL'],
  'BALRAMPUR': ['BALRAMPUR', 'GAINSARI', 'HARRAYA SATGHARWA', 'PACHPERWA', 'TULSIPUR', 'UTRAULA'],
  'BANDA': ['BABERU', 'BANDA', 'BAROKHAR KHURD', 'BISANDA', 'JASPURA', 'KAMASIN', 'MAHUVA', 'NARAINI', 'TINDWARI'],
  'BARABANKI': ['BANKI', 'DEWA', 'FATEHPUR', 'HAIDERGARH', 'HARAKH', 'NINDURA', 'RAMNAGAR', 'SIDDHAUR', 'SIRSI GAUHAR', 'SURATGANJ', 'TRIVEDIGANJ'],
  'BAREILLY': ['BAHERI', 'BAREILLY', 'BHADPUR', 'BHOJIPURA', 'BITHRI CHAINPUR', 'FARIDPUR', 'KYARA', 'MEERGANJ', 'NAWABGANJ', 'RICHHA', 'SHERGARH'],
  'BASTI': ['BANKATI', 'BASTI', 'BHANPUR', 'HARRAIYA', 'KUDRUHA', 'RAMNAGAR', 'RUDHAULI', 'SAURAHA', 'VIKRAM JOT'],
  'BHADOHI': ['AURAI', 'BHADOHI', 'DIGH', 'GYANPUR', 'SURIAWAN'],
  'BIJNOR': ['AFZALGARH', 'BIJNOR', 'CHANDPUR', 'DHAMPUR', 'HALDAUR', 'JHALU', 'KIRATPUR', 'KOTKADAR', 'NAJIBABAD', 'NEHTAUR', 'NOORPUR', 'SEOHARA'],
  'BUDAUN': ['AMBIAPUR', 'ASFAFPOOR', 'BILSAPUR', 'BUDAUN', 'BISAULI', 'DATAGANJ', 'DAHGAVAN', 'ISLAMNAGAR', 'JAGAT', 'MOJAMPUR', 'SALARPUR', 'SAMRER', 'UJHANI', 'WAZIRGANJ'],
  'BULANDSHAHR': ['AGOTA', 'ANUPSHAHR', 'ARNIYA', 'BHAWAN BAHADUR NAGAR', 'BULANDSHAHR', 'DANPUR', 'DIBALPUR', 'GULAOTHI', 'JAHANGIRABAD', 'KHURJA', 'LAKHAOTI', 'PAHASU', 'SHIKARPUR', 'SIANA', 'SIKANDRABAD', 'UNCHAGAON'],
  'CHANDAULI': ['BARHANI', 'CHAHANIYA', 'CHAKIYA', 'CHANDAULI', 'DHANAPUR', 'NAUGARH', 'NIYAMATABAD', 'SAKALDIHA', 'SHAHABGANJ'],
  'CHITRAKOOT': ['KARWI', 'MANIKPUR', 'MAU', 'PAHARI', 'RAMNAGAR', 'SHIVRAMPUR'],
  'DEORIA': ['BAITALPUR', 'BANKATA', 'BHAGALPUR', 'BHATPAR RANI', 'BHALUANI', 'DEORIA', 'DESAHI DEORIA', 'GAURI BAZAR', 'LAR', 'MAHEN', 'PATERWA', 'RAMPUR KARKHANA', 'RUDRAPUR', 'SALEMPUR', 'TARKULWA'],
  'ETAH': ['ALIGANJ', 'AWAGARH', 'ETAH', 'JAITHARA', 'JALESAR', 'MARHARA', 'NIDHAULI KALAN', 'SAKIT', 'SHEETALPUR'],
  'ETAWAH': ['BARHPURA', 'BASREHAR', 'BHARTANA', 'CHAKARNAGAR', 'ETAWAH', 'JASWANTNAGAR', 'MAHEWA', 'SAIFAI'],
  'FARRUKHABAD': ['BARH PUR', 'KAMALGANJ', 'KAIMGANJ', 'MOHAMMADABAD', 'NAWABGANJ', 'RAJEPOOR', 'SHAMSABAD'],
  'FATEHPUR': ['AIRAYAN', 'AMAULI', 'ASOTHAR', 'BAHUA', 'BHAUWAN', 'DEOMAI', 'DHATA', 'FATEHPUR', 'HASWA', 'HUSAINGANJ', 'KHAJUHA', 'MALWAN', 'TELIYANI', 'VIJAYEPUR'],
  'FIROZABAD': ['ARAON', 'EKA', 'FIROZABAD', 'JASRANA', 'KHIRAGARH', 'MADANPUR', 'NARKHI', 'SHIKOHABAD', 'TUNDLA'],
  'GAUTAM BUDDHA NAGAR': ['BISRAKH', 'DADRI', 'DANKAUR', 'JEWAR', 'NOIDA', 'GREATER NOIDA'],
  'GHAZIABAD': ['BHOJPUR', 'GHAZIABAD', 'LONI', 'MURADNAGAR', 'RAJNAGAR'],
  'GHAZIPUR': ['BHADAURA', 'BHAWARKOL', 'DEOKALI', 'GHAZIPUR', 'JAKHANIA', 'KARANDA', 'KASIMABAD', 'MANIHARI', 'MARDANPUR', 'MOHAMMADABAD', 'SADAT', 'SAIDPUR', 'VARAHI', 'ZAMANIA'],
  'GONDA': ['BABHNAN', 'BELSAR', 'CHHAPIYA', 'COLONELGANJ', 'GONDA', 'HALDHARMAU', 'ITIATHOK', 'JHANJHARI', 'KATRA BAZAR', 'MANKAPUR', 'MUJEHNA', 'NAWABGANJ', 'PARASPUR', 'RUPAI DIH', 'TARABGANJ', 'WAZIRGANJ'],
  'GORAKHPUR': ['BADHALGANJ', 'BELGHAT', 'BANSGAON', 'BHATHAT', 'BRAHMPUR', 'CAMPIRGANJ', 'CHARGAWAN', 'GAGHA', 'GOLA', 'GORAKHPUR', 'JUNGLE KAURIYA', 'KHORABAR', 'PIPRAICH', 'PIPROLI', 'SAHJANWA', 'SARDARNAGAR', 'URUWA'],
  'HAMIRPUR': ['GOHAND', 'HAMIRPUR', 'KURARA', 'MAUDAHA', 'MUSKARA', 'RATH', 'SARILA', 'SUHASPURA'],
  'HAPUR': ['DHANAURA', 'GARHMUKTESHWAR', 'HAPUR', 'SIMBHAOLI', 'SINGHAWALI AHIR'],
  'HARDOI': ['AHIRORI', 'BAWAN', 'BHARAWAN', 'BHARKKHANI', 'BILGRAM', 'HARPALPUR', 'HARDOI', 'HARIYAWAN', 'KACHHONA', 'KOTHWAN', 'MADHOGANJ', 'MALLAWAN', 'PANDARWA', 'PIHANI', 'SANDI', 'SANDILA', 'SHAHABAD', 'SURSANG', 'TODARPUR'],
  'HATHRAS': ['HATHRAS', 'HASAYAN', 'MURSAN', 'SADABAD', 'SAHAU', 'SASNI', 'SEHPAN'],
  'JALAUN': ['DAKOR', 'JALAUN', 'KADAURA', 'KALPI', 'KONCH', 'MADHOGARH', 'NADIGAON', 'RAMPURA', 'RENDHAR'],
  'JAUNPUR': ['BADLAPUR', 'BAKSHA', 'BARSATHI', 'DHARMAPUR', 'DOBHI', 'JALALPUR', 'JAUNPUR', 'KARANJA KALA', 'KERAKAT', 'KHUTAHAN', 'MACHHLISHAHR', 'MAHARAJGANG', 'MARIYAHU', 'MUFTIGANJ', 'RAMNAGAR', 'SIKRARA', 'SIRKONI', 'SUITHAKALA', 'SHAHGANJ', 'SUJANGANJ'],
  'JHANSI': ['BABINA', 'BADAURA', 'BANGRA', 'BARAGAON', 'CHIRGAON', 'GURSERAI', 'JHANSI', 'MAURANIPUR', 'MOTH'],
  'KANNAUJ': ['CHHIBRAMAU', 'GURSAYHAIGANJ', 'HASAYAN', 'JALALABAD', 'KANNAUJ', 'SAURIKH', 'TALGRAM', 'TIRWA', 'UMARDHA'],
  'KANPUR DEHAT': ['AKBARPUR', 'AMRODHA', 'DASPUR', 'DERA PUR', 'JHINJHAK', 'MAITHA', 'MALASA', 'RAJPUR', 'RASULABAD', 'RURA', 'SARVANKHERA', 'SANDALPUR', 'SHIVLI'],
  'KANPUR NAGAR': ['BILHAUR', 'CHAUBEYPUR', 'GHATAMPUR', 'KAKWAN', 'KALYANPUR', 'KANPUR', 'PATARA', 'SARSUL', 'SHIVRAJPUR', 'VIDHNU'],
  'KASGANJ': ['AMAPUR', 'GANGIRI', 'GANJDUNDWARA', 'KASGANJ', 'PATIALI', 'SAHAWAR', 'SIDHPURA', 'SORON'],
  'KAUSHAMBI': ['CHAIAL', 'CHAK', 'KADA', 'KAUSHAMBI', 'MANJHANPUR', 'MOORATGANJ', 'NEVADA', 'SARSAWAN', 'SIRTHU'],
  'KHERI': ['BANKEYGANJ', 'BEHJAM', 'BIJAULI', 'DHAURAHRA', 'ISANAGAR', 'KHERI', 'LAKHIMPUR', 'MITAULI', 'MOHAMMADI', 'NIGHASAN', 'PALIA', 'PASGAWAN', 'PHULBEHAR', 'RAMIA BEHAR'],
  'KUSHINAGAR': ['DUDHAI', 'FAZILNAGAR', 'HATA', 'KASIA', 'KHADDA', 'KUSHINAGAR', 'MOTICHAK', 'NEBUI NAURANGIA', 'PADAUNA', 'RAMKOLA', 'SEORAHI', 'SUKRAULI', 'TAMKUHI RAJ', 'VISHUNPURA'],
  'LALITPUR': ['BIRDHA', 'JAKHRAUN', 'LALITPUR', 'MADANPUR', 'MAHRONI', 'MANDAWRA', 'TALBEHAT'],
  'LUCKNOW': ['BAKSHI KA TALAB', 'CHINHAT', 'GOSAINGANJ', 'ITAUNJA', 'KAKORI', 'LUCKNOW', 'MAL', 'MALIHABAD', 'MOHANLALGANJ', 'SAROJINI NAGAR'],
  'MAHARAJGANJ': ['BRIDGMANGANJ', 'DHANI', 'GHUGLI', 'LAXMIPUR', 'MAHARAJGANJ', 'MITHOORA', 'NAUTANWA', 'NICHLAUL', 'PANIPAT', 'PARASRAMPUR', 'PHARENDA', 'SISWA'],
  'MAHOBA': ['CHARKHARI', 'JAITPUR', 'KABRAI', 'MAHOBA', 'PANWARI'],
  'MAINPURI': ['BEWAR', 'BARNAHAL', 'GHIROR', 'KARHAL', 'KISHNI', 'KURAWALI', 'KURAOLI', 'MAINPURI', 'SULTANGANJ'],
  'MATHURA': ['BALDEO', 'CHHATA', 'CHAUMUHA', 'FARAH', 'GOVERDHAN', 'MATHURA', 'NANDGAON', 'NAUJHIL', 'RAYA'],
  'MAU': ['BADRAON', 'DOHRIGHAT', 'FATEHPUR MADAON', 'GHOSI', 'KOPAGANJ', 'MOHAMMADABAD GOHNA', 'PARD AHA', 'RATANPURA', 'RANIPUR'],
  'MEERUT': ['DAURALA', 'HASTINAPUR', 'JANI KHURD', 'MACHHRA', 'MAWANA', 'MEERUT', 'PARIKSHITGARH', 'RAJPURA', 'ROHATA', 'SARDHANA', 'SARURPUR'],
  'MIRZAPUR': ['CHHANVEY', 'CHUNAR', 'CITY', 'CONCH', 'HALIA', 'JAMALPUR', 'KONA', 'LALGANJ', 'MARIHAN', 'MAJHWA', 'NARAYANPUR', 'PAHARAI', 'RAJGARH', 'SIKHAR'],
  'MORADABAD': ['BHOJPUR DHARAMPUR', 'BILARI', 'CHHAJLAT', 'DILARI', 'KUNDARKI', 'MORADABAD', 'MUNDA PANDEY', 'THAKURDWARA'],
  'MUZAFFARNAGAR': ['BAGHRA', 'BUDHANA', 'CHARTHAWAL', 'JANSATH', 'KHATOLI', 'MORNA', 'MUZAFFARNAGAR', 'PURQAZI', 'SHAH PUR'],
  'PILIBHIT': ['AMARIA', 'BARKHERA', 'BILASPUR', 'BISALPUR', 'BILSANDA', 'MARAURI', 'NEORIA', 'PILIBHIT', 'PURANPUR'],
  'PRATAPGARH': ['ASPUR DEOSARA', 'BABAGANJ', 'BIHAR', 'GAURA', 'KALAKANKAR', 'KUNDA', 'LALGANJ', 'LAKSHMANPUR', 'MANDHATA', 'MANGLA', 'PATTI', 'PRATAPGARH', 'RAMPUR SANGRAMGARH', 'SANDWA CHANDRIKA', 'SHIVGARH'],
  'PRAYAGRAJ': ['BAHADURPUR', 'BAHARIA', 'CHAKA', 'DHANUPUR', 'HANDIA', 'HOLAGARH', 'JASRA', 'KARCHHANA', 'KAURHAR', 'KAUDHIYARA', 'KORAON', 'MAU AIMA', 'MEJA', 'PHULPUR', 'PRATA PPUR', 'SAIDABAD', 'SHANKARGARH', 'SORAON', 'URWA'],
  'RAE BARELI': ['AMAWAN', 'BACHHRAWAN', 'CHHATOH', 'DAHALMAU', 'DEENSHAH GAUHAR', 'HARCHANDPUR', 'JAGATPUR', 'KHIRO', 'LALGANJ', 'MAHARAJGANJ', 'RAE BARELI', 'RAHI', 'ROOPNAGAR', 'SALON', 'SARENI', 'SATIN', 'SINGH PUR', 'TILOEE', 'UNCHAHAR'],
  'RAMPUR': ['BILASPUR', 'CHAMRAUA', 'MILAK', 'RAMPUR', 'SAIDNAGAR', 'SHAHABAD', 'SUAR'],
  'SAHARANPUR': ['BALIA KHERI', 'DEOBAND', 'GANGOH', 'MUZAFFARABAD', 'NAGAL', 'NANAUTA', 'PUWANKA', 'RAMPUR MANIHARAN', 'SADHAULI QADEEM', 'SAHARANPUR', 'SARSINA'],
  'SAMBHAL': ['ASMAULI', 'BAHJOI', 'BANIYAKHERA', 'CHANDAUSI', 'GUNNAUR', 'JUNAWAI', 'PAWASA', 'RAJPURA', 'SAMBHAL'],
  'SANT KABIR NAGAR': ['BAGHAULI', 'BELHAR KALA', 'HANGSRA', 'KHALILABAD', 'MEHDAWAL', 'NATHNAGAR', 'PAWAI', 'SAHTHA', 'SANTHA', 'SEMARIYAWA'],
  'SHAHJAHANPUR': ['BANDA', 'BHAVAL KHERA', 'DADRAUL', 'JALALABAD', 'KANT', 'KATRA', 'KHUDAGANJ', 'MADNAPUR', 'MIRZAPUR', 'NIGOHI', 'PUWAYAN', 'SHAHJAHANPUR', 'SINDHAULI', 'TILHAR'],
  'SHAMLI': ['KANDHLA', 'AIRANA', 'SHAMLI', 'THANABHAWAN', 'UN'],
  'SHRAVASTI': ['EKAUNA', 'GILOLA', 'HARIHARPUR RANI', 'IKAUNA', 'JAMUNHA', 'SIRSIYA'],
  'SIDDHARTHNAGAR': ['BIRDPOOR', 'BANSI', 'BARHNI', 'DHENIKPUR', 'DUMARIYAGANJ', 'ITWA', 'JOGIA', 'KHESRAHA', 'MITHWAL', 'NAUGARH', 'SHOHRATGARH', 'USKA BAZAR'],
  'SITAPUR': ['AIMA', 'ALIABAD', 'BISWAN', 'ELHA', 'HARGAON', 'KHAIRABAD', 'LAHARPUR', 'MACHHREHTA', 'MAHMUDABAD', 'MAHOLI', 'MISRIKH', 'PAHALWAN', 'PARSENDI', 'PISAWAN', 'RAMPUR MATHURA', 'REUSA', 'SAKRAN', 'SIDHAULI', 'SITAPUR'],
  'SONBHADRA': ['BABHANI', 'CHATRA', 'CHOPAN', 'DUDHI', 'GHORAWAL', 'MYORPUR', 'NAGWA', 'ROBERTSGANJ'],
  'SULTANPUR': ['AKHAND NAGAR', 'BALDIRAI', 'BHADAIYAN', 'DUBEYPUR', 'JAISINGHPUR', 'KADIPUR', 'KUREBHAR', 'KURWAR', 'MOTIGARPUR', 'PRATAPPUR KAMAICHA', 'SULTANPUR'],
  'UNNAO': ['ASOKPUR', 'ACHALGANJ', 'BANGARMAU', 'BICHHIYA', 'BIGAPUR', 'FATTEHPUR CHAURASI', 'GANJ MORADABAD', 'HASANGANJ', 'HILAULI', 'MIANGANJ', 'NAWABGANJ', 'PURWA', 'SAFIPUR', 'SIKANDARPUR KARAN', 'SIKANDARPUR SAROSI', 'SUMERPUR', 'UNNAO'],
  'VARANASI': ['ARAJILINE', 'BARAGAON', 'CHIRAIGAON', 'HARAHUA', 'KASHI VIDYAPEETH', 'PINDRAR', 'SEWAPURI', 'VARANASI']
};

// Exact 39 districts for LinkWell zone as returned by UPPDS API
const LINKWELL_DISTRICTS = [
  'AGRA', 'ALIGARH', 'AMROHA', 'BAGHPAT', 'BAHRAICH', 'BALRAMPUR', 'BAREILLY',
  'BASTI', 'BIJNOR', 'BUDAUN', 'BULANDSHAHAR', 'ETAH', 'FIROZABAD',
  'GAUTAM BUDDHA NAGAR', 'GHAZIABAD', 'GONDA', 'HAPUR', 'HARDOI', 'HATHRAS',
  'KASGANJ', 'KHERI', 'LUCKNOW', 'MAINPURI', 'MATHURA', 'MEERUT', 'MORADABAD',
  'MUZAFFARNAGAR', 'PILIBHIT', 'RAE BARELI', 'RAMPUR', 'SAHARANPUR', 'SAMBHAL',
  'SANT KABIR NAGAR', 'SHAHJAHANPUR', 'SHAMLI', 'SHRAVASTI', 'SIDDHARTHNAGAR',
  'SITAPUR', 'UNNAO'
];

// Fallback shops for VIKRAMJOT@BASTI as returned by UPPDS
const VIKRAMJOT_SHOPS = [
  { geography: '20550009', fpsId: '20550009', fpsName: 'Indrawati Devi Bheem Ambedakar Mahila Shg', totalCards: 429, aayCards: 96, phhCards: 333, percentAch: 93.47 },
  { geography: '20550016', fpsId: '20550016', fpsName: 'Lelawati Singh', totalCards: 261, aayCards: 118, phhCards: 143, percentAch: 99.23 },
  { geography: '20550105', fpsId: '20550105', fpsName: 'Harinarayan Singh', totalCards: 326, aayCards: 79, phhCards: 247, percentAch: 114.72 },
  { geography: '20550113', fpsId: '20550113', fpsName: 'Prem Narayan', totalCards: 256, aayCards: 63, phhCards: 193, percentAch: 83.59 },
  { geography: '20550141', fpsId: '20550141', fpsName: 'Rammurt Upadhyay Attach', totalCards: 159, aayCards: 46, phhCards: 113, percentAch: 91.19 },
  { geography: '20550161', fpsId: '20550161', fpsName: 'Umasanker', totalCards: 313, aayCards: 106, phhCards: 207, percentAch: 83.07 },
  { geography: '20550181', fpsId: '20550181', fpsName: 'Jag Narayan Singh', totalCards: 279, aayCards: 62, phhCards: 217, percentAch: 93.19 },
  { geography: '20550197', fpsId: '20550197', fpsName: 'Suman Davi', totalCards: 131, aayCards: 49, phhCards: 82, percentAch: 91.60 },
  { geography: '20550213', fpsId: '20550213', fpsName: 'Kusum Devi', totalCards: 282, aayCards: 86, phhCards: 196, percentAch: 96.10 },
  { geography: '20550231', fpsId: '20550231', fpsName: 'Krishnadhar Diwedi', totalCards: 226, aayCards: 41, phhCards: 185, percentAch: 55.31 },
  { geography: '20550244', fpsId: '20550244', fpsName: 'Jay Sanker', totalCards: 237, aayCards: 58, phhCards: 179, percentAch: 80.17 },
  { geography: '20550266', fpsId: '20550266', fpsName: 'Akhilesh Kumar', totalCards: 502, aayCards: 105, phhCards: 397, percentAch: 96.02 },
  { geography: '20550282', fpsId: '20550282', fpsName: 'Uday Narayan', totalCards: 204, aayCards: 72, phhCards: 132, percentAch: 92.16 },
  { geography: '20550290', fpsId: '20550290', fpsName: 'Satya Prakash Shukla', totalCards: 348, aayCards: 41, phhCards: 307, percentAch: 95.11 },
  { geography: '20550306', fpsId: '20550306', fpsName: 'Surendra Pratap Yadav', totalCards: 438, aayCards: 72, phhCards: 366, percentAch: 77.17 },
  { geography: '20550337', fpsId: '20550337', fpsName: 'Krishna Shyam Upadhyay', totalCards: 506, aayCards: 136, phhCards: 370, percentAch: 100.00 },
  { geography: '20550342', fpsId: '20550342', fpsName: 'Hemant Kumar Pandey', totalCards: 192, aayCards: 94, phhCards: 98, percentAch: 97.92 },
  { geography: '20550356', fpsId: '20550356', fpsName: 'Kiran Devi', totalCards: 483, aayCards: 91, phhCards: 392, percentAch: 48.03 },
  { geography: '20550374', fpsId: '20550374', fpsName: 'Krishna Nath Verma', totalCards: 302, aayCards: 104, phhCards: 198, percentAch: 94.37 },
  { geography: '20550384', fpsId: '20550384', fpsName: 'Ram Behari Shukla', totalCards: 306, aayCards: 55, phhCards: 251, percentAch: 64.38 },
  { geography: '20550401', fpsId: '20550401', fpsName: 'Shyamlta Singh', totalCards: 356, aayCards: 92, phhCards: 264, percentAch: 89.89 },
  { geography: '20550408', fpsId: '20550408', fpsName: 'Jagdamba Prasad', totalCards: 318, aayCards: 62, phhCards: 256, percentAch: 90.88 },
  { geography: '20550589', fpsId: '20550589', fpsName: 'Shashibala', totalCards: 280, aayCards: 55, phhCards: 225, percentAch: 106.07 },
  { geography: '20550599', fpsId: '20550599', fpsName: 'Sitapati', totalCards: 217, aayCards: 43, phhCards: 174, percentAch: 99.08 },
  { geography: '20550611', fpsId: '20550611', fpsName: 'Laatbaks Singh', totalCards: 194, aayCards: 56, phhCards: 138, percentAch: 96.39 },
  { geography: '20550622', fpsId: '20550622', fpsName: 'Anish Kumar Singh', totalCards: 178, aayCards: 40, phhCards: 138, percentAch: 100.56 },
  { geography: '20550641', fpsId: '20550641', fpsName: 'Tilak Ram', totalCards: 308, aayCards: 87, phhCards: 221, percentAch: 62.01 },
  { geography: '20550654', fpsId: '20550654', fpsName: 'Jai Ram', totalCards: 352, aayCards: 109, phhCards: 243, percentAch: 101.14 },
  { geography: '20550670', fpsId: '20550670', fpsName: 'Parasuram Upadhyay', totalCards: 322, aayCards: 97, phhCards: 225, percentAch: 59.32 },
  { geography: '20550681', fpsId: '20550681', fpsName: 'Savitri Devi', totalCards: 303, aayCards: 102, phhCards: 201, percentAch: 84.16 },
  { geography: '20550700', fpsId: '20550700', fpsName: 'Muse', totalCards: 194, aayCards: 40, phhCards: 154, percentAch: 80.41 },
  { geography: '20550712', fpsId: '20550712', fpsName: 'Ram Saware', totalCards: 260, aayCards: 60, phhCards: 200, percentAch: 89.20 }
];

const CANDIDATE_MONTHS = ['2026-01-01', process.env.UPPDS_MONTH, '2026-02-01', '2025-12-01'].filter(Boolean);
const UPPDS_BASE = process.env.UPPDS_API || 'https://portal.uppds.in/api/PublicDashboard/DashboardTxnCumAuthReport/excel';

// Helper to fetch from UPPDS with candidate months
async function fetchUppdsWithFallback(urlBuilder) {
  for (const m of CANDIDATE_MONTHS) {
    try {
      const u = urlBuilder(m);
      const res = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://portal.uppds.in/',
          'Origin': 'https://portal.uppds.in',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 9000
      });
      const d = res.data;
      const rows = Array.isArray(d) ? d : (d?.rows || []);
      if (rows && rows.length > 0) return rows;
    } catch (_) {}
  }
  return [];
}

// ── GET /api/fps/districts — UP districts from UPPDS API in ascending alphabetical order ──
r.get('/districts', async (req, res) => {
  try {
    const month = req.query.allotmentmonth || '2026-01-01';
    const zone = req.query.zone || 'LinkWell';
    const rowsParam = req.query.rows || '50';

    // Exact API call:
    // https://portal.uppds.in/api/PublicDashboard/DashboardTxnCumAuthReport/excel?curLevel=STATE&geography=UTTAR%20PRADESH&zone=LinkWell&allotmentmonth=2026-01-01&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=...&rows=50&page=1&sidx=&sord=asc
    let liveRows = [];
    try {
      const u = `${UPPDS_BASE}?curLevel=STATE&geography=UTTAR%20PRADESH&zone=${encodeURIComponent(zone)}&allotmentmonth=${encodeURIComponent(month)}&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${Date.now()}&rows=${rowsParam}&page=1&sidx=&sord=asc`;
      const resp = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://portal.uppds.in/',
          'Origin': 'https://portal.uppds.in',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 9000
      });
      const d = resp.data;
      liveRows = Array.isArray(d) ? d : (d?.rows || []);
    } catch (e) {
      console.warn('[UPPDS districts direct fetch failed, trying fallback months]', e.message);
      liveRows = await fetchUppdsWithFallback(m =>
        `${UPPDS_BASE}?curLevel=STATE&geography=UTTAR%20PRADESH&zone=${encodeURIComponent(zone)}&allotmentmonth=${m}&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${Date.now()}&rows=${rowsParam}&page=1&sidx=&sord=asc`
      );
    }

    let districts = [];
    if (liveRows && liveRows.length > 0) {
      const set = new Set();
      liveRows.forEach(r => {
        const name = (r.geography || r.district || '').trim().toUpperCase();
        if (name) set.add(name);
      });
      districts = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } else {
      // Safe fallback: exact 39 districts for LinkWell zone provided by user
      districts = [...LINKWELL_DISTRICTS].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      liveRows = districts.map((d, idx) => ({ id: 39911400 + idx, level: 'DISTRICT', geography: d, district: d, zoneGroup: zone, serialno: idx + 1 }));
    }

    res.json({ success: true, count: districts.length, districts, rows: liveRows });
  } catch (err) {
    console.error('[Districts endpoint error]', err.message);
    const districts = [...LINKWELL_DISTRICTS].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    res.json({ success: true, count: districts.length, districts, rows: districts.map((d, idx) => ({ id: 39911400 + idx, level: 'DISTRICT', geography: d, district: d, serialno: idx + 1 })) });
  }
});

// ── GET /api/fps/tehsils & /api/fps/blocks — Blocks for selected district ──
const handleTehsils = async (req, res) => {
  try {
    const rawDist = String(req.query.district || '').trim().toUpperCase();
    if (!rawDist) return res.json({ success: true, tehsils: [], blocks: [], rows: [] });

    const month = req.query.allotmentmonth || '2026-01-01';
    const zone = req.query.zone || 'LinkWell';
    const rowsParam = req.query.rows || '50';

    // Exact API call:
    // https://portal.uppds.in/api/PublicDashboard/DashboardTxnCumAuthReport/excel?curLevel=DISTRICT&geography=${district}&zone=LinkWell&allotmentmonth=2026-01-01&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=...&rows=50&page=1&sidx=&sord=asc
    let liveRows = [];
    try {
      const u = `${UPPDS_BASE}?curLevel=DISTRICT&geography=${encodeURIComponent(rawDist)}&zone=${encodeURIComponent(zone)}&allotmentmonth=${encodeURIComponent(month)}&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${Date.now()}&rows=${rowsParam}&page=1&sidx=&sord=asc`;
      const resp = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://portal.uppds.in/',
          'Origin': 'https://portal.uppds.in',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 9000
      });
      const d = resp.data;
      liveRows = Array.isArray(d) ? d : (d?.rows || []);
    } catch (e) {
      console.warn('[UPPDS tehsils direct fetch failed, trying fallback months]', e.message);
      liveRows = await fetchUppdsWithFallback(m =>
        `${UPPDS_BASE}?curLevel=DISTRICT&geography=${encodeURIComponent(rawDist)}&zone=${encodeURIComponent(zone)}&allotmentmonth=${m}&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${Date.now()}&rows=${rowsParam}&page=1&sidx=&sord=asc`
      );
    }

    let tehsils = [];
    if (liveRows && liveRows.length > 0) {
      const set = new Set();
      liveRows.forEach(r => {
        const name = (r.geography || r.tehsilName || '').trim().toUpperCase();
        if (name) set.add(name);
      });
      tehsils = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } else {
      const fallbackList = UP_TEHSILS[rawDist] || [];
      tehsils = fallbackList.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      liveRows = tehsils.map((t, idx) => ({ id: 39911570 + idx, level: 'TEHSIL', geography: t, tehsilName: t, parent: t, district: rawDist, serialno: idx + 1 }));
    }

    res.json({ success: true, count: tehsils.length, tehsils, blocks: tehsils, rows: liveRows });
  } catch (err) {
    console.error('[Tehsils endpoint error]', err.message);
    const rawDist = String(req.query.district || '').trim().toUpperCase();
    const fallback = (UP_TEHSILS[rawDist] || []).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    res.json({ success: true, count: fallback.length, tehsils: fallback, blocks: fallback, rows: fallback.map(t => ({ level: 'TEHSIL', geography: t, tehsilName: t })) });
  }
};
r.get('/tehsils', handleTehsils);
r.get('/blocks', handleTehsils);

// ── GET /api/fps/shops-by-block — FPS shops for district + block in ASCENDING ALPHABETICAL ORDER ──
r.get('/shops-by-block', async (req, res) => {
  try {
    const rawDist = String(req.query.district || '').trim().toUpperCase();
    const rawTeh = String(req.query.tehsil || req.query.block || '').trim().toUpperCase();

    if (!rawDist || !rawTeh) {
      return res.json({ success: true, shops: [], rows: [] });
    }

    const month = req.query.allotmentmonth || '2026-01-01';
    const zone = req.query.zone || 'LinkWell';
    const rowsParam = req.query.rows || '100';

    const shopMap = new Map();

    // 1. Fetch live FPS shops from UPPDS:
    // https://portal.uppds.in/api/PublicDashboard/DashboardTxnCumAuthReport/excel?curLevel=TEHSIL&geography=VIKRAMJOT%40BASTI&zone=LinkWell&allotmentmonth=2026-01-01&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=...&rows=100&page=1&sidx=&sord=asc
    let liveRows = [];
    try {
      const geoParam = `${encodeURIComponent(rawTeh)}%40${encodeURIComponent(rawDist)}`;
      const u = `${UPPDS_BASE}?curLevel=TEHSIL&geography=${geoParam}&zone=${encodeURIComponent(zone)}&allotmentmonth=${encodeURIComponent(month)}&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${Date.now()}&rows=${rowsParam}&page=1&sidx=&sord=asc`;
      const resp = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://portal.uppds.in/',
          'Origin': 'https://portal.uppds.in',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 9000
      });
      const d = resp.data;
      liveRows = Array.isArray(d) ? d : (d?.rows || []);
    } catch (e) {
      console.warn('[UPPDS shops direct fetch failed, trying fallback months]', e.message);
      const geoParam = `${encodeURIComponent(rawTeh)}%40${encodeURIComponent(rawDist)}`;
      liveRows = await fetchUppdsWithFallback(m =>
        `${UPPDS_BASE}?curLevel=TEHSIL&geography=${geoParam}&zone=${encodeURIComponent(zone)}&allotmentmonth=${m}&fps=&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${Date.now()}&rows=${rowsParam}&page=1&sidx=&sord=asc`
      );
    }

    if (liveRows && liveRows.length > 0) {
      liveRows.forEach(s => {
        const id = String(s.geography || s.fpsId || '').trim();
        if (id) {
          shopMap.set(id, {
            geography: id,
            fpsId: id,
            fpsName: s.fpsName || `FPS Shop ${id}`,
            level: 'FPS',
            totalCards: s.totalCards || 0,
            aayCards: s.aayCards || 0,
            phhCards: s.phhCards || 0,
            totalTxns: s.totalTxns || 0,
            percentAch: s.percentAch || 0,
            serialno: s.serialno || shopMap.size + 1,
            district: rawDist,
            block: rawTeh,
            isRegistered: false,
            source: 'live'
          });
        }
      });
    }

    // Fallback if live rows was empty and it's VIKRAMJOT@BASTI
    if (shopMap.size === 0 && rawTeh === 'VIKRAMJOT' && rawDist === 'BASTI') {
      VIKRAMJOT_SHOPS.forEach(s => {
        const id = String(s.geography || s.fpsId);
        shopMap.set(id, { ...s, district: rawDist, block: rawTeh, isRegistered: false, source: 'fallback' });
      });
    }

    // 2. Fetch registered shops in MongoDB matching district and block
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const dbShops = await Shop.find({
          $or: [
            { 'apiSnapshot.district': new RegExp(rawDist, 'i'), 'apiSnapshot.block': new RegExp(rawTeh, 'i') },
            { 'apiSnapshot.district': new RegExp(rawDist, 'i') }
          ]
        }).select('shopId shopName ownerName apiSnapshot');

        dbShops.forEach(s => {
          const id = String(s.shopId).trim();
          const existing = shopMap.get(id);
          if (existing) {
            existing.isRegistered = true;
            existing.fpsName = s.shopName || existing.fpsName;
            existing.ownerName = s.ownerName || existing.ownerName;
          } else {
            shopMap.set(id, {
              geography: id,
              fpsId: id,
              fpsName: s.shopName || (s.apiSnapshot && s.apiSnapshot.fpsName) || `FPS Shop ${id}`,
              ownerName: s.ownerName || '',
              level: 'FPS',
              totalCards: s.apiSnapshot?.totalCards || 0,
              district: rawDist,
              block: rawTeh,
              isRegistered: true,
              source: 'annseva'
            });
          }
        });
      }
    } catch (_) {}

    // Convert map to array
    const shops = Array.from(shopMap.values());

    // 3. CRITICAL REQUIREMENT: SORT IN ASCENDING ORDER OF ALPHABET (A to Z)
    shops.sort((a, b) => {
      const nameA = (a.fpsName || a.shopName || '').trim();
      const nameB = (b.fpsName || b.shopName || '').trim();
      const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return String(a.geography || '').localeCompare(String(b.geography || ''));
    });

    res.json({ success: true, count: shops.length, shops, rows: shops });
  } catch (err) {
    console.error('[Shops by block endpoint]', err.message);
    res.json({ success: true, shops: [], rows: [] });
  }
});

// ── UPPDS proxy — backward compatible, resilient with month fallback and alphabetical sorting ──
r.get('/uppds-proxy', async (req, res) => {
  try {
    let url = req.query.url || '';
    // If double-encoded, decode once; if already decoded, don't break
    if (typeof url === 'string' && url.includes('%3A%2F%2F')) {
      try { url = decodeURIComponent(url); } catch (_) {}
    }

    if (!url || !url.startsWith('https://portal.uppds.in/')) {
      return res.status(400).json({ error: 'Invalid URL', rows: [] });
    }

    const tryFetch = async (targetUrl) => {
      const { data } = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': 'https://portal.uppds.in/',
          'Origin': 'https://portal.uppds.in',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 12000
      });
      return data;
    };

    let data;
    try {
      data = await tryFetch(url);
    } catch (e) {
      console.warn('[UPPDS proxy initial attempt failed]', e.message);
    }

    let rows = Array.isArray(data) ? data : (data?.rows || []);

    // If empty result or failed, retry with fallback allotment months
    if (!rows || rows.length === 0) {
      for (const m of CANDIDATE_MONTHS) {
        if (url.includes(`allotmentmonth=${m}`)) continue;
        const fallbackUrl = url.replace(/allotmentmonth=[^&]+/, `allotmentmonth=${m}`);
        try {
          const fallbackData = await tryFetch(fallbackUrl);
          const fallbackRows = Array.isArray(fallbackData) ? fallbackData : (fallbackData?.rows || []);
          if (fallbackRows && fallbackRows.length > 0) {
            data = fallbackData;
            rows = fallbackRows;
            break;
          }
        } catch (_) {}
      }
    }

    // Fallbacks if UPPDS was unreachable
    if (!rows || rows.length === 0) {
      if (url.includes('curLevel=STATE')) {
        const sortedDistricts = [...UP_DISTRICTS].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return res.json({
          rows: sortedDistricts.map(d => ({ level: 'DISTRICT', geography: d, district: d }))
        });
      }
      if (url.includes('curLevel=DISTRICT')) {
        const match = url.match(/geography=([^&]+)/);
        const dist = match ? decodeURIComponent(match[1]).trim().toUpperCase() : '';
        const blocks = (UP_TEHSILS[dist] || []).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return res.json({
          rows: blocks.map(b => ({ level: 'TEHSIL', geography: b, tehsilName: b }))
        });
      }
    }

    // If shop level results, ensure ASCENDING ALPHABETICAL ORDER
    if (Array.isArray(rows) && (url.includes('curLevel=TEHSIL') || rows[0]?.level === 'FPS' || rows[0]?.fpsName)) {
      rows.sort((a, b) => {
        const nameA = (a.fpsName || a.shopName || '').trim();
        const nameB = (b.fpsName || b.shopName || '').trim();
        const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return String(a.geography || '').localeCompare(String(b.geography || ''));
      });
      if (Array.isArray(data)) data = rows;
      else if (data && data.rows) data.rows = rows;
    }

    res.json(data || { rows: [] });
  } catch (e) {
    console.error('[UPPDS proxy]', e.message);
    res.json({ error: 'Upstream fetch failed', rows: [] });
  }
});

// SmartPDS Live Endpoints — Stock Register & ePOS Transactions
r.get('/:shopId/stock-register',  requireAuth, requireOwnShop, c.getStockRegister);
r.post('/:shopId/stock-register', requireAuth, requireOwnShop, c.getStockRegister);
r.get('/:shopId/transactions',    requireAuth, requireOwnShop, c.getTransactions);
r.post('/:shopId/transactions',   requireAuth, requireOwnShop, c.getTransactions);

// Owner-only — this is the shop's own SmartPDS/UPPDS data and receipts.
r.get('/:shopId/data',     requireAuth, requireOwnShop, c.getFPSData);
r.get('/:shopId/receipt',  requireAuth, requireOwnShop, c.getReceipt);
r.get('/:shopId/summary',  requireAuth, requireOwnShop, c.getFPSSummary);
r.post('/:shopId/refresh', requireAuth, requireOwnShop, c.refreshShopData);

module.exports = r;
