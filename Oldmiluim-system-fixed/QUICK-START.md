# 📱 מדריך התקנה מצולם - Windows

## 🎯 מה את עושה עכשיו:

### ✅ שלב 1: הורד את הקובץ הנכון
[הורד קובץ ZIP](computer:///mnt/user-data/outputs/miluim-system.zip)

👆 לחץ כאן והורד

---

### ✅ שלב 2: חלץ את הקבצים

**אחרי הורדה:**
```
1. לחיצה ימנית על: miluim-system.zip
2. בחר: "Extract All..." או "חלץ הכל..."
3. תקבל תיקייה: miluim-system
```

**איך זה אמור להיראות אחרי חילוץ:**
```
📁 miluim-system/
   ✅ package.json          ← אם אתה רואה את זה - טוב!
   ✅ start-windows.bat
   ✅ README.md
   📁 server/
      ├── index.js
      └── database.js
   📁 public/
      ├── index.html
      ├── css/
      └── js/
```

---

### ✅ שלב 3: בדוק Node.js

**פתח CMD (חלון פקודות) וכתוב:**
```
node -v
```

**אמור להראות משהו כמו:**
```
v20.11.0
```

**❌ אם רואה שגיאה "node is not recognized":**
1. לך ל: https://nodejs.org
2. הורד את הכפתור **הירוק** (LTS)
3. התקן (Next → Next → Install)
4. **אתחל מחשב!** (חשוב!)

---

### ✅ שלב 4: פתח PowerShell בתיקייה

**דרך קלה:**
```
1. פתח את התיקייה miluim-system ב-File Explorer
2. Shift + לחיצה ימנית על רקע ריק
3. בחר: "Open PowerShell window here"
```

**אמור להיראות:**
```
PS C:\Users\...\miluim-system>
                      ↑
                   זה טוב!
```

---

### ✅ שלב 5: הרץ הכל

**בתוך PowerShell, הקלד:**
```
.\start-windows.bat
```

**אחרי זה תראה:**
```
[1/3] בודק אם Node.js מותקן...
✅ Node.js מותקן

[2/3] מתקין חבילות...
(יכול לקחת דקה)

[3/3] מפעיל שרת...
✅ השרת פועל על: http://localhost:3000
```

---

### ✅ שלב 6: פתח דפדפן

```
1. פתח Chrome / Edge / Firefox
2. כתוב בשורת כתובת: localhost:3000
3. Enter
```

**אמור לראות:**
```
🎖️ מערכת ניהול תשלומי מילואים
ליטאי ניהול שירותים
```

בצבעים ירוקים של ליטאי! ✅

---

## 🐛 תקלות נפוצות:

### ❌ "package.json not found"
**זה אומר:** הקבצים לא חולצו או שאת בתיקייה הלא נכונה

**פתרון:**
1. חזור לשלב 2
2. ודא שחילצת את הקבצים
3. ודא שאת רואה `package.json` בתיקייה
4. PowerShell חייב להיות בדיוק בתיקייה `miluim-system`

---

### ❌ "npm ERR! code ENOENT"
**זה אומר:** אותו דבר - לא בתיקייה הנכונה

**פתרון:**
הקלד:
```
cd miluim-system
```
ואז שוב:
```
npm install
```

---

### ❌ "node is not recognized"
**זה אומר:** Node.js לא מותקן או לא באמצע

**פתרון:**
1. הורד מ: https://nodejs.org
2. התקן
3. **אתחל מחשב**
4. נסה שוב

---

### ❌ "port 3000 already in use"
**זה אומר:** כבר יש תוכנית אחרת על פורט 3000

**פתרון מהיר:**
1. Ctrl+C (עצור את השרת)
2. פתח `server/index.js`
3. שורה 9: שנה `3000` ל-`3001`
4. שמור
5. הפעל שוב

---

## 💡 מה זה SQLite?

**בקצרה:**
- זה בסיס נתונים קטן
- נשמר בקובץ אחד: `miluim.db`
- ייווצר אוטומטית בפעם הראשונה
- **כל המידע שלך נשמר שם!**

**איפה הוא?**
```
📁 miluim-system/
   📁 server/
      📄 miluim.db  ← כאן!
```

**גיבוי:**
פשוט תעתיק את הקובץ `miluim.db` למקום בטוח

---

## 🎬 סרטון הדרכה:

אם עדיין מבלבל - יש סרטוני YouTube על:
1. "How to install Node.js on Windows"
2. "How to extract ZIP files"
3. "How to open PowerShell in folder"

---

## 🆘 עדיין תקוע?

**שלח לי 3 דברים:**
1. צילום מסך של השגיאה
2. צילום מסך של התיקייה (מה רואים בפנים)
3. תוצאה של: `node -v` ו-`npm -v`

אני אעזור מיד! 🚀

---

נוצר במיוחד עבור ליטאי ניהול שירותים
Innovation in Balance 🎖️
