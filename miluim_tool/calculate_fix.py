# תיקון לוגיקת חישוב - לפי תקופות ולא חודשים

def calculate_all_fixed(self):
    """חישוב מלא - לפי תקופות"""
    try:
        self.status_var.set("Calculating...")
        self.root.update()
        
        self.backup_file()
        
        wb = load_workbook(SYSTEM_FILE)
        ws_periods = wb['2️⃣ תקופות מילואים']
        ws_btl = wb['3️⃣ תשלומי ב"ל']
        ws_summary = wb['4️⃣ דוח מסכם']
        ws_employees = wb['1️⃣ רשימת עובדים']
        
        # קריאת תעריפים
        df_employees = pd.read_excel(SYSTEM_FILE, sheet_name='1️⃣ רשימת עובדים')
        employee_data = {}
        for _, emp in df_employees.iterrows():
            name = self.normalize_name(emp['שם מלא'])
            employee_data[name] = {
                'rate': emp.get('תעריף יומי', 0),
                'monthly': emp.get('משכורת חודשית', 0)
            }
        
        # קריאת תקופות - כל תקופה בנפרד
        df_periods = pd.read_excel(SYSTEM_FILE, sheet_name='2️⃣ תקופות מילואים')
        df_btl = pd.read_excel(SYSTEM_FILE, sheet_name='3️⃣ תשלומי ב"ל')
        
        summary_data = []
        
        # לולאה על כל תקופה (לא קיבוץ!)
        for _, period in df_periods.iterrows():
            emp = self.normalize_name(period['שם עובד'])
            period_id = period['מזהה תקופה']
            start_date = period['תאריך התחלה']
            end_date = period['תאריך סיום']
            total_days = period['סה"כ ימים']
            weekdays = period['ימי א-ה']
            
            emp_info = employee_data.get(emp, {})
            rate = emp_info.get('rate', 0)
            monthly = emp_info.get('monthly', 0)
            
            # חישוב תשלום מעסיק
            if weekdays > 20:
                employer_payment = monthly
            else:
                employer_payment = weekdays * rate
            
            # משיכת תשלומי ב"ל - התאמה לפי תאריכים
            start_parsed = self.parse_date(start_date)
            end_parsed = self.parse_date(end_date)
            
            btl_payments = df_btl[
                (df_btl['שם עובד'].apply(self.normalize_name) == emp) &
                (df_btl['תאריך התחלה'].apply(self.parse_date) == start_parsed) &
                (df_btl['תאריך סיום'].apply(self.parse_date) == end_parsed)
            ]
            
            btl_tagmul = btl_payments['תגמול ₪'].sum()
            btl_pitzuy = btl_payments['פיצוי 20% ₪'].sum()
            btl_40 = btl_payments['תוספת 40% ₪'].sum()
            
            difference = employer_payment - btl_tagmul
            
            summary_data.append({
                'מזהה': period_id,
                'עובד': emp,
                'התחלה': start_date,
                'סיום': end_date,
                'ימים': total_days,
                'ימי א-ה': weekdays,
                'תעריף': rate,
                'תשלום מעסיק': employer_payment,
                'תגמול ב"ל': btl_tagmul,
                'פיצוי 20%': btl_pitzuy,
                'תוספת 40%': btl_40,
                'הפרש': difference
            })
        
        # ניקוי דוח מסכם
        for row in range(ws_summary.max_row, 1, -1):
            if row > 1:
                ws_summary.delete_rows(row)
        
        next_row = 2
        for item in summary_data:
            ws_summary.cell(next_row, 1).value = item['עובד']
            ws_summary.cell(next_row, 2).value = item['מזהה']
            ws_summary.cell(next_row, 3).value = item['התחלה']
            ws_summary.cell(next_row, 4).value = item['סיום']
            ws_summary.cell(next_row, 5).value = item['ימים']
            ws_summary.cell(next_row, 6).value = item['ימי א-ה']
            ws_summary.cell(next_row, 7).value = item['תעריף']
            ws_summary.cell(next_row, 8).value = item['תשלום מעסיק']
            ws_summary.cell(next_row, 9).value = item['תגמול ב"ל']
            ws_summary.cell(next_row, 10).value = item['פיצוי 20%']
            ws_summary.cell(next_row, 11).value = item['תוספת 40%']
            ws_summary.cell(next_row, 12).value = item['הפרש']
            
            if abs(item['הפרש']) < 1:
                status = "מאוזן"
            elif item['הפרש'] > 0:
                status = "ממתין"
            else:
                status = "לא רלוונטי"
            ws_summary.cell(next_row, 13).value = status
            
            self.color_row(ws_summary, next_row, COLOR_NEW)
            
            next_row += 1
        
        wb.save(SYSTEM_FILE)
        
        total_employer = sum(x['תשלום מעסיק'] for x in summary_data)
        total_btl = sum(x['תגמול ב"ל'] for x in summary_data)
        total_diff = sum(x['הפרש'] for x in summary_data)
        
        self.status_var.set("Calculation complete")
        messagebox.showinfo("Success", 
            f"Calculation Complete\n\n"
            f"✅ Periods: {len(summary_data)} (green)\n\n"
            f"Employer: {total_employer:,.0f} NIS\n"
            f"BTL: {total_btl:,.0f} NIS\n"
            f"Difference: {total_diff:,.0f} NIS")
        
    except Exception as e:
        self.status_var.set("Error")
        messagebox.showerror("Error", f"Calculation Error:\n{str(e)}")
