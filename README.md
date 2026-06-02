# Taxi Accounting System

نظام محاسبة تكسي Full-Stack مبني بـ `Next.js App Router` + `MongoDB`.

## المميزات

- إدارة السائقين والمنسقين (إضافة، تعديل، حذف، بحث وتصفية)
- إدخال الطلبات اليومية مع حساب العمولة تلقائيًا
- تقارير يومية/أسبوعية/شهرية وتقارير مفصلة لكل سائق
- إعدادات العمولة (نسبة أو مبلغ ثابت) وتغيير كلمة مرور الأدمن
- Dashboard سريع بملخص يومي
- مصادقة Admin بسيطة عبر JWT Cookie + Middleware
- تصميم Mobile-first مع دعم الوضع الداكن

## المتطلبات

- Node.js 20+
- MongoDB (Local أو Atlas)

## التشغيل

1. انسخ ملف البيئة:

```bash
cp .env.example .env.local
```

2. عدل القيم داخل `.env.local`:

- `MONGODB_URI`
- `JWT_SECRET`
- `OPENAI_API_KEY` (لصفحة الإدخال الذكي من واتساب)
- `OPENAI_MODEL` (اختياري، الافتراضي: `gpt-4o-mini`)

3. ثبت الحزم:

```bash
npm install
```

4. (اختياري) إدخال بيانات تجريبية:

```bash
npm run seed
```

5. تشغيل المشروع:

```bash
npm run dev
```

ثم افتح [http://localhost:3000](http://localhost:3000)

## تسجيل الدخول الافتراضي

- كلمة المرور: `admin123`
- يمكن تغييرها من صفحة الإعدادات بعد الدخول.

## هيكل مختصر

- `src/app/api/*` واجهات API
- `src/app/(app)/*` صفحات النظام المحمية
- `src/models/*` نماذج MongoDB
- `src/lib/*` أدوات مشتركة (DB, Auth, Commission)
- `scripts/seed.ts` بيانات تجريبية
