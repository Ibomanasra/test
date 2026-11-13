/**
 * Datenschutzerklärung des Shops (سياسة الخصوصية) – AR/EN/HE.
 * Text ändern: hier bearbeiten und UPDATED anpassen. Kontaktdaten kommen aus den Firmen-Einstellungen.
 * Absätze: Strings; Aufzählungen: string[]; **fett** wird hervorgehoben.
 */
export const PRIVACY_UPDATED = "2026-11-13";

export interface PrivacySection {
  title: string;
  body: (string | string[])[];
}

export interface PrivacyText {
  title: string;
  updated: string;
  intro: string;
  sections: PrivacySection[];
  contactTitle: string;
  contactIntro: string;
  phone: string;
  email: string;
  address: string;
}

const ar: PrivacyText = {
  title: "سياسة الخصوصية",
  updated: "آخر تحديث",
  intro: "أهلاً بكم في **شعلة الجنوب** – متجركم للمنظفات والأدوات المنزلية والمواد الغذائية بأسعار الجملة. نحترم خصوصيتكم، وتوضح هذه الصفحة ما هي البيانات التي نجمعها، ولماذا، وكيف نحميها.",
  sections: [
    {
      title: "ما هي البيانات التي نجمعها؟",
      body: [
        "**بيانات تقدّمونها لنا:**",
        [
          "**عند الطلب** (مع حساب أو بدون حساب): الاسم، رقم الهاتف، عنوان التوصيل، وأي ملاحظة تكتبونها على الطلب.",
          "**عند إنشاء حساب:** الاسم ورقم الهاتف وكلمة المرور – كلمة المرور تُحفظ مشفّرة ولا يستطيع أحد قراءتها، حتى نحن.",
          "**للتجار:** اسم المحل وبيانات النشاط التجاري اللازمة لتفعيل أسعار التجار والفواتير.",
        ],
        "**بيانات تُجمع تلقائياً:**",
        [
          "سجل طلباتكم وفواتيركم.",
          "**إحصائيات زيارة مجهولة:** نعدّ الصفحات والمنتجات التي شوهدت، ومصدر الزيارة (مثل واتساب أو إنستغرام)، ونوع الجهاز واللغة – باستخدام رقم عشوائي في ملف تعريف الارتباط (Cookie). لا ترتبط هذه الإحصائيات باسمكم أو رقم هاتفكم.",
          "بيانات تقنية تُستخدم مؤقتاً لحماية المتجر (مثل منع محاولات الدخول المتكررة).",
        ],
      ],
    },
    {
      title: "كيف نستخدم بياناتكم؟",
      body: [
        [
          "تجهيز طلباتكم وتسليمها لشركة التوصيل لتصل إليكم بأسرع وقت.",
          "التواصل معكم بخصوص حالة الطلب أو أي استفسار.",
          "إصدار الفواتير ومتابعة الحسابات (للتجار).",
          "إعلامكم بالعروض والخصومات – ويمكنكم طلب إيقاف ذلك في أي وقت.",
          "تحسين المتجر: معرفة المنتجات الأكثر طلباً وأفضل أوقات الزيارة.",
        ],
      ],
    },
    {
      title: "ملفات تعريف الارتباط (Cookies)",
      body: [
        [
          "**ضرورية:** لتسجيل الدخول وسلة المشتريات واللغة.",
          "**إحصائية مجهولة:** لعدّ الزوار فقط، وتبقى حتى 400 يوم.",
          "**لا نستخدم** إعلانات تتبّع من شركات خارجية ولا Google Analytics.",
        ],
      ],
    },
    {
      title: "التوصيل والدفع",
      body: [
        [
          "نوصل الطلبات إلى كافة مدن الضفة الغربية عن طريق شركات توصيل معتمدة.",
          "**رسوم التوصيل** لمنطقتكم تظهر بوضوح قبل تأكيد الطلب.",
          "**طريقة الدفع:** نقداً عند الاستلام (للتجار حسب الاتفاق).",
          "لا نطلب ولا نحفظ بيانات بطاقات بنكية.",
        ],
      ],
    },
    {
      title: "مشاركة البيانات",
      body: [
        [
          "**لا نبيع ولا نؤجر** بياناتكم الشخصية لأي جهة.",
          "نعطي شركة التوصيل فقط ما يلزم لإيصال الطلب: الاسم، رقم الهاتف، العنوان، والمبلغ المطلوب تحصيله.",
          "قد نكشف بيانات إذا طلبتها جهة رسمية بموجب القانون.",
        ],
      ],
    },
    {
      title: "حماية البيانات ومدة الاحتفاظ بها",
      body: [
        [
          "اتصال مشفّر (HTTPS)، كلمات مرور مشفّرة، والموظفون المخوّلون فقط يرون بيانات الطلبات، مع نسخ احتياطية منتظمة.",
          "نحتفظ بالطلبات والفواتير المدة التي يفرضها القانون. الإحصائيات المجهولة تُحذف تلقائياً بعد 400 يوم.",
        ],
      ],
    },
    {
      title: "حقوقكم",
      body: [
        [
          "**الاطلاع على بياناتكم وتعديلها** من صفحة «حسابي» أو بالتواصل معنا.",
          "**طلب حذف الحساب:** تواصلوا معنا وسنحذف بياناتكم الشخصية، باستثناء ما يلزمنا القانون بالاحتفاظ به (مثل الفواتير).",
          "يمكنكم منع ملفات تعريف الارتباط من إعدادات المتصفح، لكن قد لا تعمل السلة أو تسجيل الدخول عندها.",
        ],
      ],
    },
    {
      title: "تغييرات على هذه السياسة",
      body: ["قد نحدّث هذه السياسة من وقت لآخر، ونُعلن أي تغيير مهم في هذه الصفحة مع تاريخ التحديث."],
    },
  ],
  contactTitle: "التواصل معنا",
  contactIntro: "لأي استفسار حول الخصوصية أو لطلب حذف بياناتكم:",
  phone: "هاتف / واتساب",
  email: "البريد الإلكتروني",
  address: "العنوان",
};

const en: PrivacyText = {
  title: "Privacy Policy",
  updated: "Last updated",
  intro: "Welcome to **Sholat Aljanoub** – your shop for cleaning products, household goods and groceries at wholesale prices. We respect your privacy. This page explains what data we collect, why, and how we protect it.",
  sections: [
    {
      title: "What data do we collect?",
      body: [
        "**Data you give us:**",
        [
          "**When you order** (with or without an account): name, phone number, delivery address and any note you add to the order.",
          "**When you create an account:** name, phone number and password – the password is stored encrypted and nobody can read it, not even us.",
          "**For dealers:** shop name and the business details needed for dealer prices and invoices.",
        ],
        "**Data collected automatically:**",
        [
          "Your order and invoice history.",
          "**Anonymous visit statistics:** we count pages and products viewed, where the visit came from (e.g. WhatsApp or Instagram), device type and language – using a random number in a cookie. These statistics are not linked to your name or phone number.",
          "Technical data used temporarily to protect the shop (e.g. blocking repeated login attempts).",
        ],
      ],
    },
    {
      title: "How do we use your data?",
      body: [
        [
          "To prepare your orders and hand them to the delivery company so they reach you quickly.",
          "To contact you about your order or any question.",
          "To issue invoices and manage accounts (dealers).",
          "To tell you about offers and discounts – you can ask us to stop at any time.",
          "To improve the shop: which products are popular and when people visit.",
        ],
      ],
    },
    {
      title: "Cookies",
      body: [
        [
          "**Necessary:** for login, the shopping cart and language.",
          "**Anonymous statistics:** only to count visitors, kept for up to 400 days.",
          "**We do not use** tracking ads from third parties or Google Analytics.",
        ],
      ],
    },
    {
      title: "Delivery and payment",
      body: [
        [
          "We deliver to all cities in the West Bank through approved delivery companies.",
          "The **delivery fee** for your area is shown clearly before you confirm the order.",
          "**Payment:** cash on delivery (dealers as agreed).",
          "We never ask for or store bank card details.",
        ],
      ],
    },
    {
      title: "Sharing data",
      body: [
        [
          "We **never sell or rent** your personal data to anyone.",
          "The delivery company only receives what it needs to deliver: name, phone number, address and the amount to collect.",
          "We may disclose data if required by an authority under the law.",
        ],
      ],
    },
    {
      title: "Protection and retention",
      body: [
        [
          "Encrypted connection (HTTPS), encrypted passwords, only authorised staff can see order data, regular backups.",
          "Orders and invoices are kept as long as the law requires. Anonymous statistics are deleted automatically after 400 days.",
        ],
      ],
    },
    {
      title: "Your rights",
      body: [
        [
          "**See and correct your data** on the “My account” page or by contacting us.",
          "**Delete your account:** contact us and we will delete your personal data, except what the law requires us to keep (such as invoices).",
          "You can block cookies in your browser settings, but the cart and login may then not work.",
        ],
      ],
    },
    {
      title: "Changes to this policy",
      body: ["We may update this policy from time to time and will announce important changes on this page with the update date."],
    },
  ],
  contactTitle: "Contact us",
  contactIntro: "For any privacy question or to request deletion of your data:",
  phone: "Phone / WhatsApp",
  email: "Email",
  address: "Address",
};

const he: PrivacyText = {
  title: "מדיניות פרטיות",
  updated: "עדכון אחרון",
  intro: "ברוכים הבאים ל**שועלת אלג'נוב** – החנות שלכם למוצרי ניקיון, כלי בית ומזון במחירים סיטונאיים. אנו מכבדים את פרטיותכם. דף זה מסביר אילו נתונים אנו אוספים, למה, וכיצד אנו מגנים עליהם.",
  sections: [
    {
      title: "אילו נתונים אנו אוספים?",
      body: [
        "**נתונים שאתם מוסרים לנו:**",
        [
          "**בעת הזמנה** (עם או בלי חשבון): שם, מספר טלפון, כתובת למשלוח וכל הערה שתוסיפו להזמנה.",
          "**בעת פתיחת חשבון:** שם, מספר טלפון וסיסמה – הסיסמה נשמרת מוצפנת ואף אחד לא יכול לקרוא אותה, גם לא אנחנו.",
          "**לסוחרים:** שם העסק ופרטי העסק הנדרשים למחירי סוחרים ולחשבוניות.",
        ],
        "**נתונים שנאספים אוטומטית:**",
        [
          "היסטוריית ההזמנות והחשבוניות שלכם.",
          "**סטטיסטיקת ביקורים אנונימית:** אנו סופרים דפים ומוצרים שנצפו, מקור הביקור (למשל וואטסאפ או אינסטגרם), סוג המכשיר והשפה – באמצעות מספר אקראי בעוגייה (Cookie). הנתונים אינם מקושרים לשמכם או למספר הטלפון שלכם.",
          "נתונים טכניים המשמשים זמנית להגנה על החנות (למשל חסימת ניסיונות כניסה חוזרים).",
        ],
      ],
    },
    {
      title: "כיצד אנו משתמשים בנתונים?",
      body: [
        [
          "הכנת ההזמנות ומסירתן לחברת המשלוחים כדי שיגיעו אליכם במהירות.",
          "יצירת קשר בנוגע להזמנה או לכל שאלה.",
          "הפקת חשבוניות וניהול חשבונות (לסוחרים).",
          "עדכון על מבצעים והנחות – ניתן לבקש להפסיק בכל עת.",
          "שיפור החנות: אילו מוצרים מבוקשים ומתי אנשים מבקרים.",
        ],
      ],
    },
    {
      title: "עוגיות (Cookies)",
      body: [
        [
          "**הכרחיות:** לכניסה לחשבון, לסל הקניות ולשפה.",
          "**סטטיסטיקה אנונימית:** רק לספירת מבקרים, נשמרות עד 400 יום.",
          "**איננו משתמשים** בפרסום עוקב של צד שלישי או ב-Google Analytics.",
        ],
      ],
    },
    {
      title: "משלוח ותשלום",
      body: [
        [
          "אנו שולחים לכל ערי הגדה המערבית באמצעות חברות משלוחים מורשות.",
          "**דמי המשלוח** לאזורכם מוצגים בבירור לפני אישור ההזמנה.",
          "**תשלום:** במזומן בעת המסירה (לסוחרים לפי הסכם).",
          "איננו מבקשים ואיננו שומרים פרטי כרטיסי אשראי.",
        ],
      ],
    },
    {
      title: "שיתוף נתונים",
      body: [
        [
          "**איננו מוכרים ואיננו משכירים** את הנתונים האישיים שלכם לאף גורם.",
          "חברת המשלוחים מקבלת רק את מה שנדרש למסירה: שם, טלפון, כתובת והסכום לגבייה.",
          "ייתכן שנמסור נתונים אם רשות מוסמכת תדרוש זאת על פי חוק.",
        ],
      ],
    },
    {
      title: "הגנה ושמירת נתונים",
      body: [
        [
          "חיבור מוצפן (HTTPS), סיסמאות מוצפנות, רק עובדים מורשים רואים נתוני הזמנות, וגיבויים קבועים.",
          "הזמנות וחשבוניות נשמרות כנדרש בחוק. הסטטיסטיקה האנונימית נמחקת אוטומטית אחרי 400 יום.",
        ],
      ],
    },
    {
      title: "הזכויות שלכם",
      body: [
        [
          "**לצפות בנתונים ולתקן אותם** בדף «החשבון שלי» או בפנייה אלינו.",
          "**מחיקת חשבון:** פנו אלינו ונמחק את הנתונים האישיים, למעט מה שהחוק מחייב לשמור (כגון חשבוניות).",
          "ניתן לחסום עוגיות בהגדרות הדפדפן, אך ייתכן שהסל והכניסה לא יעבדו.",
        ],
      ],
    },
    {
      title: "שינויים במדיניות",
      body: ["ייתכן שנעדכן מדיניות זו מעת לעת, ונפרסם שינויים חשובים בדף זה עם תאריך העדכון."],
    },
  ],
  contactTitle: "צרו קשר",
  contactIntro: "לכל שאלה בנושא פרטיות או לבקשת מחיקת נתונים:",
  phone: "טלפון / וואטסאפ",
  email: "אימייל",
  address: "כתובת",
};

export const PRIVACY: Record<string, PrivacyText> = { ar, en, he };
