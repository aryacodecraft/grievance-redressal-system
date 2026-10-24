import type { MessageKey } from "./en";

type ResolutionMessages = Partial<Record<MessageKey, string>>;

export const resolutionBn: ResolutionMessages = {
  activityHistory: "কার্যকলাপের ইতিহাস", noActivityHistory: "এখনও নাগরিকদের দেখার মতো কোনো আপডেট দেওয়া হয়নি।",
  resolutionSummary: "সমাধানের সারাংশ", resolutionFeedbackTitle: "সমাধানটি কেমন হয়েছে?", feedbackReceived: "আপনার মতামত",
  feedbackRating: "সমাধানকে মূল্যায়ন করুন", excellent: "চমৎকার", good: "ভালো", average: "মোটামুটি", poor: "খারাপ", veryPoor: "খুব খারাপ",
  feedbackComment: "আরও জানান", feedbackPlaceholder: "কী ভালো হয়েছে বা কী উন্নত করা যায়?", sendFeedback: "মতামত পাঠান", saving: "সংরক্ষণ হচ্ছে…",
  furtherActionTitle: "সমস্যা রয়ে গেছে? পরবর্তী পদক্ষেপের অনুরোধ করুন", furtherActionHelp: "সমস্যাটি সমাধান না হলে কী বাকি আছে জানান। বিভাগীয় দল আপনার অনুরোধ পর্যালোচনা করবে।",
  furtherActionPlaceholder: "কী ঠিক হয়নি তা লিখুন (কমপক্ষে ১০ অক্ষর)।", requestFurtherAction: "পরবর্তী পদক্ষেপের অনুরোধ করুন", sending: "পাঠানো হচ্ছে…",
  furtherActionSent: "আপনার অনুরোধটি পর্যালোচনার জন্য বিভাগে পাঠানো হয়েছে।", furtherActionAlreadyRequested: "আপনি ইতিমধ্যে পরবর্তী পদক্ষেপের অনুরোধ করেছেন। আপডেটের জন্য এখানে দেখুন।",
  feedbackSaved: "ধন্যবাদ। আপনার মতামত সংরক্ষিত হয়েছে।", actionFailed: "এখন সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।",
};
export const resolutionTe: ResolutionMessages = {
  activityHistory: "కార్యకలాపాల చరిత్ర", noActivityHistory: "ఇంకా పౌరులకు కనిపించే అప్‌డేట్‌లు లేవు.",
  resolutionSummary: "పరిష్కార సారాంశం", resolutionFeedbackTitle: "పరిష్కారం ఎలా ఉంది?", feedbackReceived: "మీ అభిప్రాయం",
  feedbackRating: "పరిష్కారానికి రేటింగ్ ఇవ్వండి", excellent: "అద్భుతం", good: "బాగుంది", average: "పర్వాలేదు", poor: "బాగాలేదు", veryPoor: "చాలా బాగాలేదు",
  feedbackComment: "మరింత చెప్పండి", feedbackPlaceholder: "ఏది బాగా జరిగింది లేదా ఏది మెరుగుపరచవచ్చు?", sendFeedback: "అభిప్రాయం పంపండి", saving: "సేవ్ అవుతోంది…",
  furtherActionTitle: "సమస్య ఇంకా పరిష్కారం కాలేదా? తదుపరి చర్య కోరండి", furtherActionHelp: "సమస్య ఇంకా పరిష్కారం కాకపోతే, ఏమి మిగిలిందో వివరించండి. మీ విభాగం అభ్యర్థనను సమీక్షిస్తుంది.",
  furtherActionPlaceholder: "ఇంకా ఏది సరిచేయలేదో వివరించండి (కనీసం 10 అక్షరాలు).", requestFurtherAction: "తదుపరి చర్య కోరండి", sending: "పంపుతోంది…",
  furtherActionSent: "మీ అభ్యర్థన సమీక్ష కోసం విభాగానికి పంపబడింది.", furtherActionAlreadyRequested: "మీరు ఇప్పటికే తదుపరి చర్య కోరారు. అప్‌డేట్‌ల కోసం ఇక్కడ చూడండి.",
  feedbackSaved: "ధన్యవాదాలు. మీ అభిప్రాయం సేవ్ చేయబడింది.", actionFailed: "ఇప్పుడు సేవ్ చేయలేకపోయాం. మళ్లీ ప్రయత్నించండి.",
};
export const resolutionTa: ResolutionMessages = {
  activityHistory: "செயல்பாட்டு வரலாறு", noActivityHistory: "குடிமக்கள் பார்க்கக்கூடிய புதுப்பிப்புகள் இன்னும் இல்லை.",
  resolutionSummary: "தீர்வின் சுருக்கம்", resolutionFeedbackTitle: "தீர்வு எப்படி இருந்தது?", feedbackReceived: "உங்கள் கருத்து",
  feedbackRating: "தீர்வுக்கு மதிப்பிடுங்கள்", excellent: "மிகச் சிறப்பு", good: "நன்று", average: "சுமார்", poor: "மோசம்", veryPoor: "மிகவும் மோசம்",
  feedbackComment: "மேலும் பகிருங்கள்", feedbackPlaceholder: "எது நன்றாக இருந்தது அல்லது எதை மேம்படுத்தலாம்?", sendFeedback: "கருத்தை அனுப்பு", saving: "சேமிக்கப்படுகிறது…",
  furtherActionTitle: "சிக்கல் தீரவில்லையா? அடுத்த நடவடிக்கையைக் கோருங்கள்", furtherActionHelp: "சிக்கல் இன்னும் தீரவில்லை என்றால், எது மீதமுள்ளது என்பதை விளக்குங்கள். துறை உங்கள் கோரிக்கையை மதிப்பாய்வு செய்யும்.",
  furtherActionPlaceholder: "இன்னும் சரிசெய்யப்படாததை எழுதுங்கள் (குறைந்தது 10 எழுத்துகள்).", requestFurtherAction: "அடுத்த நடவடிக்கையைக் கோருங்கள்", sending: "அனுப்பப்படுகிறது…",
  furtherActionSent: "உங்கள் கோரிக்கை மதிப்பாய்வுக்காகத் துறைக்கு அனுப்பப்பட்டது.", furtherActionAlreadyRequested: "நீங்கள் ஏற்கனவே அடுத்த நடவடிக்கையைக் கோரியுள்ளீர்கள். புதுப்பிப்புகளை இங்கே பார்க்கவும்.",
  feedbackSaved: "நன்றி. உங்கள் கருத்து சேமிக்கப்பட்டது.", actionFailed: "இப்போது சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
};
export const resolutionGu: ResolutionMessages = {
  activityHistory: "પ્રવૃત્તિનો ઇતિહાસ", noActivityHistory: "હજુ સુધી નાગરિકોને દેખાય એવા અપડેટ આપવામાં આવ્યા નથી.",
  resolutionSummary: "ઉકેલનો સારાંશ", resolutionFeedbackTitle: "ઉકેલ કેવો રહ્યો?", feedbackReceived: "તમારો પ્રતિસાદ",
  feedbackRating: "ઉકેલને રેટ કરો", excellent: "ઉત્તમ", good: "સારું", average: "સરેરાશ", poor: "નબળું", veryPoor: "ખૂબ નબળું",
  feedbackComment: "વધુ જણાવો", feedbackPlaceholder: "શું સારું થયું અથવા શું સુધારી શકાય?", sendFeedback: "પ્રતિસાદ મોકલો", saving: "સાચવી રહ્યા છીએ…",
  furtherActionTitle: "સમસ્યા હજી ઉકેલાઈ નથી? આગળની કાર્યવાહી માંગો", furtherActionHelp: "સમસ્યા હજી ઉકેલાઈ ન હોય તો શું બાકી છે તે જણાવો. વિભાગ તમારી વિનંતીની સમીક્ષા કરશે.",
  furtherActionPlaceholder: "હજી શું સુધર્યું નથી તે લખો (ઓછામાં ઓછા 10 અક્ષરો).", requestFurtherAction: "આગળની કાર્યવાહી માંગો", sending: "મોકલી રહ્યા છીએ…",
  furtherActionSent: "તમારી વિનંતી સમીક્ષા માટે વિભાગને મોકલવામાં આવી છે.", furtherActionAlreadyRequested: "તમે આગળની કાર્યવાહી માટે વિનંતી કરી છે. અપડેટ અહીં તપાસો.",
  feedbackSaved: "આભાર. તમારો પ્રતિસાદ સાચવાયો છે.", actionFailed: "હમણાં સાચવી શકાયું નથી. ફરી પ્રયાસ કરો.",
};
export const resolutionKn: ResolutionMessages = {
  activityHistory: "ಚಟುವಟಿಕೆ ಇತಿಹಾಸ", noActivityHistory: "ನಾಗರಿಕರಿಗೆ ಕಾಣುವ ನವೀಕರಣಗಳು ಇನ್ನೂ ಇಲ್ಲ.",
  resolutionSummary: "ಪರಿಹಾರದ ಸಾರಾಂಶ", resolutionFeedbackTitle: "ಪರಿಹಾರ ಹೇಗಿತ್ತು?", feedbackReceived: "ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆ",
  feedbackRating: "ಪರಿಹಾರಕ್ಕೆ ರೇಟಿಂಗ್ ನೀಡಿ", excellent: "ಅತ್ಯುತ್ತಮ", good: "ಚೆನ್ನಾಗಿದೆ", average: "ಸಾಧಾರಣ", poor: "ಕಳಪೆ", veryPoor: "ತುಂಬಾ ಕಳಪೆ",
  feedbackComment: "ಇನ್ನಷ್ಟು ತಿಳಿಸಿ", feedbackPlaceholder: "ಯಾವುದು ಚೆನ್ನಾಗಿತ್ತು ಅಥವಾ ಏನನ್ನು ಸುಧಾರಿಸಬಹುದು?", sendFeedback: "ಪ್ರತಿಕ್ರಿಯೆ ಕಳುಹಿಸಿ", saving: "ಉಳಿಸಲಾಗುತ್ತಿದೆ…",
  furtherActionTitle: "ಸಮಸ್ಯೆ ಬಗೆಹರಿದಿಲ್ಲವೇ? ಮುಂದಿನ ಕ್ರಮ ಕೋರಿ", furtherActionHelp: "ಸಮಸ್ಯೆ ಇನ್ನೂ ಬಗೆಹರಿಯದಿದ್ದರೆ, ಏನು ಬಾಕಿಯಿದೆ ಎಂದು ವಿವರಿಸಿ. ನಿಮ್ಮ ವಿಭಾಗವು ವಿನಂತಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.",
  furtherActionPlaceholder: "ಇನ್ನೂ ಸರಿಯಾಗದಿರುವುದನ್ನು ವಿವರಿಸಿ (ಕನಿಷ್ಠ 10 ಅಕ್ಷರಗಳು).", requestFurtherAction: "ಮುಂದಿನ ಕ್ರಮ ಕೋರಿ", sending: "ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…",
  furtherActionSent: "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಪರಿಶೀಲನೆಗಾಗಿ ವಿಭಾಗಕ್ಕೆ ಕಳುಹಿಸಲಾಗಿದೆ.", furtherActionAlreadyRequested: "ನೀವು ಈಗಾಗಲೇ ಮುಂದಿನ ಕ್ರಮ ಕೋರಿದ್ದೀರಿ. ನವೀಕರಣಗಳಿಗಾಗಿ ಇಲ್ಲಿ ನೋಡಿ.",
  feedbackSaved: "ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಉಳಿಸಲಾಗಿದೆ.", actionFailed: "ಈಗ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};
export const resolutionMl: ResolutionMessages = {
  activityHistory: "പ്രവർത്തന ചരിത്രം", noActivityHistory: "പൗരന്മാർക്ക് കാണാവുന്ന അപ്‌ഡേറ്റുകളൊന്നും ഇതുവരെ നൽകിയിട്ടില്ല.",
  resolutionSummary: "പരിഹാരത്തിന്റെ സംഗ്രഹം", resolutionFeedbackTitle: "പരിഹാരം എങ്ങനെയുണ്ടായിരുന്നു?", feedbackReceived: "നിങ്ങളുടെ പ്രതികരണം",
  feedbackRating: "പരിഹാരത്തിന് റേറ്റിംഗ് നൽകുക", excellent: "മികച്ചത്", good: "നല്ലത്", average: "ശരാശരി", poor: "മോശം", veryPoor: "വളരെ മോശം",
  feedbackComment: "കൂടുതൽ പറയൂ", feedbackPlaceholder: "എന്താണ് നന്നായി നടന്നത്, എന്താണ് മെച്ചപ്പെടുത്താനാവുക?", sendFeedback: "പ്രതികരണം അയയ്ക്കുക", saving: "സംരക്ഷിക്കുന്നു…",
  furtherActionTitle: "പ്രശ്നം പരിഹരിക്കപ്പെട്ടില്ലേ? തുടർനടപടി അഭ്യർത്ഥിക്കുക", furtherActionHelp: "പ്രശ്നം ഇപ്പോഴും പരിഹരിക്കപ്പെട്ടിട്ടില്ലെങ്കിൽ ബാക്കിയുള്ളത് വിശദീകരിക്കുക. വകുപ്പ് നിങ്ങളുടെ അഭ്യർത്ഥന പരിശോധിക്കും.",
  furtherActionPlaceholder: "ഇനിയും പരിഹരിക്കാത്തത് വിവരിക്കുക (കുറഞ്ഞത് 10 അക്ഷരങ്ങൾ).", requestFurtherAction: "തുടർനടപടി അഭ്യർത്ഥിക്കുക", sending: "അയയ്ക്കുന്നു…",
  furtherActionSent: "നിങ്ങളുടെ അഭ്യർത്ഥന പരിശോധനയ്ക്കായി വകുപ്പിലേക്ക് അയച്ചു.", furtherActionAlreadyRequested: "നിങ്ങൾ തുടർനടപടി ഇതിനകം അഭ്യർത്ഥിച്ചു. അപ്‌ഡേറ്റുകൾ ഇവിടെ പരിശോധിക്കുക.",
  feedbackSaved: "നന്ദി. നിങ്ങളുടെ പ്രതികരണം സംരക്ഷിച്ചു.", actionFailed: "ഇപ്പോൾ സംരക്ഷിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.",
};
export const resolutionPa: ResolutionMessages = {
  activityHistory: "ਗਤੀਵਿਧੀ ਦਾ ਇਤਿਹਾਸ", noActivityHistory: "ਹਾਲੇ ਨਾਗਰਿਕਾਂ ਨੂੰ ਦਿਖਣ ਵਾਲੇ ਅੱਪਡੇਟ ਨਹੀਂ ਦਿੱਤੇ ਗਏ।",
  resolutionSummary: "ਹੱਲ ਦਾ ਸਾਰ", resolutionFeedbackTitle: "ਹੱਲ ਕਿਵੇਂ ਰਿਹਾ?", feedbackReceived: "ਤੁਹਾਡੀ ਰਾਏ",
  feedbackRating: "ਹੱਲ ਨੂੰ ਰੇਟ ਕਰੋ", excellent: "ਸ਼ਾਨਦਾਰ", good: "ਚੰਗਾ", average: "ਠੀਕ-ਠਾਕ", poor: "ਮਾੜਾ", veryPoor: "ਬਹੁਤ ਮਾੜਾ",
  feedbackComment: "ਹੋਰ ਦੱਸੋ", feedbackPlaceholder: "ਕੀ ਚੰਗਾ ਰਿਹਾ ਜਾਂ ਕੀ ਸੁਧਾਰਿਆ ਜਾ ਸਕਦਾ ਹੈ?", sendFeedback: "ਰਾਏ ਭੇਜੋ", saving: "ਸੰਭਾਲਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  furtherActionTitle: "ਸਮੱਸਿਆ ਹੱਲ ਨਹੀਂ ਹੋਈ? ਅਗਲੀ ਕਾਰਵਾਈ ਦੀ ਬੇਨਤੀ ਕਰੋ", furtherActionHelp: "ਜੇ ਸਮੱਸਿਆ ਹਾਲੇ ਹੱਲ ਨਹੀਂ ਹੋਈ ਤਾਂ ਦੱਸੋ ਕਿ ਕੀ ਬਾਕੀ ਹੈ। ਵਿਭਾਗ ਤੁਹਾਡੀ ਬੇਨਤੀ ਦੀ ਸਮੀਖਿਆ ਕਰੇਗਾ।",
  furtherActionPlaceholder: "ਦੱਸੋ ਕਿ ਹਾਲੇ ਕੀ ਠੀਕ ਨਹੀਂ ਹੋਇਆ (ਘੱਟੋ-ਘੱਟ 10 ਅੱਖਰ)।", requestFurtherAction: "ਅਗਲੀ ਕਾਰਵਾਈ ਦੀ ਬੇਨਤੀ ਕਰੋ", sending: "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  furtherActionSent: "ਤੁਹਾਡੀ ਬੇਨਤੀ ਸਮੀਖਿਆ ਲਈ ਵਿਭਾਗ ਨੂੰ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ।", furtherActionAlreadyRequested: "ਤੁਸੀਂ ਅਗਲੀ ਕਾਰਵਾਈ ਦੀ ਬੇਨਤੀ ਕਰ ਚੁੱਕੇ ਹੋ। ਅੱਪਡੇਟ ਇੱਥੇ ਵੇਖੋ।",
  feedbackSaved: "ਧੰਨਵਾਦ। ਤੁਹਾਡੀ ਰਾਏ ਸੰਭਾਲ ਲਈ ਗਈ ਹੈ।", actionFailed: "ਹੁਣੇ ਸੰਭਾਲਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
};
export const resolutionOr: ResolutionMessages = {
  activityHistory: "କାର୍ଯ୍ୟକଳାପ ଇତିହାସ", noActivityHistory: "ଏପର୍ଯ୍ୟନ୍ତ ନାଗରିକଙ୍କୁ ଦେଖାଯାଉଥିବା ଅପଡେଟ୍ ଦିଆଯାଇନାହିଁ।",
  resolutionSummary: "ସମାଧାନର ସାରାଂଶ", resolutionFeedbackTitle: "ସମାଧାନ କିପରି ହେଲା?", feedbackReceived: "ଆପଣଙ୍କ ମତାମତ",
  feedbackRating: "ସମାଧାନକୁ ରେଟିଂ ଦିଅନ୍ତୁ", excellent: "ଉତ୍କୃଷ୍ଟ", good: "ଭଲ", average: "ମଧ୍ୟମ", poor: "ଖରାପ", veryPoor: "ବହୁତ ଖରାପ",
  feedbackComment: "ଅଧିକ କୁହନ୍ତୁ", feedbackPlaceholder: "କଣ ଭଲ ହେଲା କିମ୍ବା କଣ ଉନ୍ନତ କରାଯାଇପାରେ?", sendFeedback: "ମତାମତ ପଠାନ୍ତୁ", saving: "ସଞ୍ଚୟ ହେଉଛି…",
  furtherActionTitle: "ସମସ୍ୟା ସମାଧାନ ହୋଇନାହିଁ? ପରବର୍ତ୍ତୀ କାର୍ଯ୍ୟ ଅନୁରୋଧ କରନ୍ତୁ", furtherActionHelp: "ସମସ୍ୟା ଏବେ ମଧ୍ୟ ସମାଧାନ ହୋଇନାହିଁ ହେଲେ କଣ ବାକି ଅଛି କୁହନ୍ତୁ। ବିଭାଗ ଆପଣଙ୍କ ଅନୁରୋଧ ସମୀକ୍ଷା କରିବ।",
  furtherActionPlaceholder: "କଣ ଏବେ ମଧ୍ୟ ଠିକ୍ ହୋଇନାହିଁ ଲେଖନ୍ତୁ (ଅତି କମରେ 10 ଅକ୍ଷର)।", requestFurtherAction: "ପରବର୍ତ୍ତୀ କାର୍ଯ୍ୟ ଅନୁରୋଧ କରନ୍ତୁ", sending: "ପଠାଯାଉଛି…",
  furtherActionSent: "ଆପଣଙ୍କ ଅନୁରୋଧ ସମୀକ୍ଷା ପାଇଁ ବିଭାଗକୁ ପଠାଯାଇଛି।", furtherActionAlreadyRequested: "ଆପଣ ପୂର୍ବରୁ ପରବର୍ତ୍ତୀ କାର୍ଯ୍ୟ ଅନୁରୋଧ କରିଛନ୍ତି। ଅପଡେଟ୍ ପାଇଁ ଏଠାରେ ଦେଖନ୍ତୁ।",
  feedbackSaved: "ଧନ୍ୟବାଦ। ଆପଣଙ୍କ ମତାମତ ସଞ୍ଚୟ ହୋଇଛି।", actionFailed: "ଏବେ ସଞ୍ଚୟ ହୋଇପାରିଲା ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
};
