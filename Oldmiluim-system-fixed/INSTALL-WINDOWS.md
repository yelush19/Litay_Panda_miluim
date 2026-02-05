# 🪟 התקנה למחשב Windows - פשוט ומהיר!

## ⚠️ קיבלת שגיאה? קרא את זה!

### הבעיה שקיבלת:
```
npm error enoent Could not read package.json
```

**משמעות:** הקבצים לא חולצו נכון, או שאת בתיקייה הלא נכונה.

---

## ✅ פתרון מהיר - 5 שלבים:

### **שלב 1: הורדת Node.js**
1. כנס ל: https://nodejs.org
2. הורד את הכפתור הירוק: **"LTS"**
3. הפעל את ההתקנה (Next → Next → Install)
4. אתחל את המחשב (חשוב!)

### **שלב 2: חילוץ הקבצים**
1. הורד את הקובץ: `miluim-system.tar.gz`
2. **לחץ עליו לחיצה ימנית** → "Extract All" או "Extract Here"
3. אם אין אפשרות כזו - הורד **WinRAR** או **7-Zip**
4. תקבל תיקייה בשם: `miluim-system`

### **שלב 3: בדוק שיש את הקבצים האלה:**
פתח את התיקייה `miluim-system` וודא שרואה:
```
📁 miluim-system/
   📄 package.json          ← חשוב! חייב להיות!
   📄 start-windows.bat     ← זה יפעיל הכל
   📄 README.md
   📁 server/
   📁 public/
```

**אם אין `package.json` - הקבצים לא חולצו נכון!**

### **שלב 4: פתח PowerShell בתיקייה הנכונה**
1. פתח את התיקייה `miluim-system` ב-Explorer
2. **Shift + לחיצה ימנית** על רקע ריק
3. בחר: **"Open PowerShell window here"** 
   או **"פתח חלון PowerShell כאן"**

### **שלב 5: הפעל את הסקריפט**
הקלד:
```
.\start-windows.bat
```

זהו! המערכת תתקין ותעלה אוטומטית.

---

## 🎯 אופציה 2: התקנה ידנית (אם הסקריפט לא עובד)

### **בתוך PowerShell, בתיקייה `miluim-system`:**

```powershell
# 1. בדוק Node.js
node -v

# 2. התקן חבילות
npm install

# 3. הפעל שרת
npm start
```

אחרי זה פתח דפדפן: **http://localhost:3000**

---

## 🐛 שגיאות נפוצות ופתרונות:

### ❌ "node is not recognized"
**פתרון:** Node.js לא מותקן או לא באמצע PATH
1. אתחל מחשב
2. נסה שוב
3. אם לא עובד - התקן Node.js מחדש

### ❌ "package.json not found"
**פתרון:** אתה לא בתיקייה הנכונה!
1. ודא שאתה ב: `C:\...\miluim-system\`
2. ודא שרואה `package.json` בתיקייה

### ❌ "permission denied"
**פתרון:** הרץ PowerShell כמנהל
1. לחץ ימני על PowerShell
2. "Run as Administrator"

### ❌ "port 3000 already in use"
**פתרון:** כבר יש תוכנית על פורט 3000
- סגור תוכניות פתוחות
- או שנה פורט ב: `server/index.js` (שורה 9)

---

## 📹 וידאו הדרכה (אם צריך):

1. חילוץ קבצים: https://www.youtube.com/watch?v=example
2. התקנת Node.js: https://nodejs.org/en/download

---

## 🆘 עדיין לא עובד?

**שלח לי:**
1. צילום מסך של השגיאה המלאה
2. צילום מסך של התיקייה `miluim-system` (מה יש בפנים)
3. הפלט של הפקודה: `node -v`

---

## 💡 טיפ חשוב:

**SQLite** = זה בסיס נתונים קטן שנשמר בקובץ אחד.
- לא צריך להתקין שום דבר נוסף
- הקובץ ייקרא `miluim.db` וייווצר אוטומטית
- זה כמו Excel, אבל יותר מתקדם ומהיר

**כל הנתונים שלך נשמרים בקובץ הזה!**
גבה אותו מדי פעם (העתק למקום בטוח).

---

נוצר עבור ליטאי ניהול שירותים 🎖️
