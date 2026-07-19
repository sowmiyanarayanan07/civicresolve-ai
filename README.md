# 🌿 Civic Resolve AI

> **AI-Powered Smart Civic Grievance Management Platform**

Civic Resolve AI is an AI-powered web platform that enables citizens to report public infrastructure issues such as potholes, water leaks, drainage problems, damaged streetlights, garbage accumulation, and other civic complaints. The platform intelligently categorizes complaints, prioritizes them based on severity, and routes them to the appropriate municipal department, helping authorities resolve issues faster and more efficiently.

By combining Artificial Intelligence, location-based services, and real-time complaint tracking, Civic Resolve AI enhances transparency, improves communication between citizens and government authorities, and contributes to the development of smarter and more sustainable cities.

---

## 📖 Table of Contents

- Overview
- Problem Statement
- Solution
- Features
- AI Capabilities
- Technology Stack
- Project Workflow
- Folder Structure
- Installation
- Environment Variables
- Future Enhancements
- Contributing
- License

---

# 📌 Overview

Traditional civic grievance systems often suffer from delayed responses, manual complaint categorization, lack of transparency, and inefficient communication between citizens and authorities.

Civic Resolve AI addresses these challenges through an intelligent, user-friendly platform that automates complaint categorization, enables real-time status tracking, and provides administrators with powerful tools to manage civic issues effectively.

---

# ❗ Problem Statement

Citizens frequently experience problems such as:

- Road potholes
- Water leakage
- Garbage overflow
- Broken streetlights
- Drainage blockages
- Public infrastructure damage

Existing complaint systems usually involve:

- Manual verification
- Slow response times
- Poor tracking
- Lack of accountability
- Inefficient complaint prioritization

---

# 💡 Solution

Civic Resolve AI streamlines the entire complaint management process by allowing citizens to submit complaints with images, descriptions, and locations. AI assists in categorizing complaints and determining their severity, while administrators can assign issues to the appropriate departments and monitor resolution progress through an intuitive dashboard.

---

# ✨ Features

## 👤 Citizen Portal

- Secure user authentication
- Register and log in
- Submit complaints with images
- GPS/location support
- Track complaint status
- View complaint history
- Real-time updates

---

## 🛠 Admin Dashboard

- Manage all complaints
- Assign complaints to departments
- Monitor complaint progress
- Update complaint status
- View analytics dashboard
- Manage users
- Track issue resolution

---

## 🤖 AI Features

- Intelligent complaint categorization
- Severity assessment
- Priority-based issue handling
- Smart workflow assistance
- Faster decision making

---

## 📍 Location Services

- Interactive maps
- Location-based complaint reporting
- Accurate issue identification
- Better resource allocation

---

## 🔔 Notifications

- Complaint submission confirmation
- Status updates
- Resolution notifications

---

# 🚀 Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

## Backend

- Supabase
- PostgreSQL
- Edge Functions

## Authentication

- Supabase Authentication
- Email Verification

## AI Integration

- Google Gemini AI

## Maps

- MapLibre GL

## Email Services

- EmailJS

---

# ⚙️ Project Workflow

```
Citizen
    │
    ▼
Submit Complaint
    │
    ▼
Upload Image + Location
    │
    ▼
AI Categorizes Complaint
    │
    ▼
Priority Assessment
    │
    ▼
Admin Dashboard
    │
    ▼
Assign Department
    │
    ▼
Field Officer
    │
    ▼
Issue Resolution
    │
    ▼
Citizen Receives Update
```

---

# 📂 Project Structure

```
civicresolve-ai/
│
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── contexts/
│   ├── integrations/
│   ├── utils/
│   └── assets/
│
├── supabase/
├── package.json
├── vite.config.ts
└── README.md
```

---

# 🛠 Installation

Clone the repository

```bash
git clone https://github.com/sowmiyanarayanan07/civicresolve-ai.git
```

Move into the project

```bash
cd civicresolve-ai
```

Install dependencies

```bash
npm install
```

Start development server

```bash
npm run dev
```

Build production version

```bash
npm run build
```

---

# 🔑 Environment Variables

Create a `.env` file.

```env
VITE_SUPABASE_URL=your_supabase_url

VITE_SUPABASE_ANON_KEY=your_supabase_key

VITE_EMAILJS_PUBLIC_KEY=your_emailjs_key

VITE_EMAILJS_SERVICE_ID=your_service_id

VITE_EMAILJS_TEMPLATE_ID=your_template_id

VITE_GEMINI_API_KEY=your_gemini_api_key
```

---

# 📈 Future Enhancements

- Mobile application
- AI-powered image damage detection
- Automatic duplicate complaint detection
- Predictive maintenance
- Voice-based complaint registration
- Multi-language support
- Offline reporting
- Government ERP integration
- Push notifications
- Performance analytics dashboard

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.

---

# 📜 License

This project is licensed under the MIT License.

---

# 👨‍💻 Developed By

**Sowmiya Narayanan S**

B.Tech Artificial Intelligence & Data Science

AI | Full Stack Development | Data Science | Machine Learning

---

## ⭐ If you found this project useful, consider giving it a Star on GitHub!
