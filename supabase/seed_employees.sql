-- 1. Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.admins CASCADE;

-- 2. Create Admins Table
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Employees Table (Updated with Phone and Availability)
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  phone TEXT,
  availability_status TEXT DEFAULT 'Available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 5. Simple RLS Policies (Allow App Reading)
CREATE POLICY "Public full access" ON public.admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON public.employees FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed Admin User
INSERT INTO public.admins (name, email)
VALUES ('sowmiyanarayanan', 'ramnaveen606@gmail.com');

-- 7. Seed Employees
-- LIGHT DEPARTMENT
INSERT INTO public.employees (name, phone, email, department, availability_status) VALUES
('AKASH A', '9629733884', 'masterbobesh@gmail.com', 'light', 'Available'),
('ANGEL PRISCILLA G', '9789760544', 'angelpriscilla200@gmail.com', 'light', 'Available'),
('ASHOK G', '9385927379', 'ashok350gnanam@gmail.com', 'light', 'Available'),
('BALAGURU C', '9842627936', 'balakgf7@gmail.com', 'light', 'Available'),
('BALAMURUGAN K', '6369485625', 'bala979039@gmail.com', 'light', 'Available'),
('BATHMAPRIYA P', '7548869256', 'kpbathmapriya@gmail.com', 'light', 'Available'),
('BHARATHKUMAR', '9597799765', 'bharathbharu159@gmail.com', 'light', 'Available'),
('BUVANESHWARAR S', '8610637425', 'buvi1unique@gmail.com', 'light', 'Available'),
('CHANDRU D', '6380857178', 'dchandru650@gmail.com', 'light', 'Available'),
('CHANDRU K', '7418780641', 'chandru957863@gmail.com', 'light', 'Available'),
('DEENUL SAFIQ S', '6385639808', 'deenulsafiq@gmail.com', 'light', 'Available'),
('DEEPRITHA R', '9150706050', 'rdeepritha@gmail.com', 'light', 'Available'),
('ELUMALAI M', '9514723713', 'elumalaimanjamuthu2003@gmail.com', 'light', 'Available');

-- POTHOLE DEPARTMENT
INSERT INTO public.employees (name, phone, email, department, availability_status) VALUES
('ELUMUGAM R', '9585155367', 'ElumugamElumgam@gamil.com', 'pothole', 'Available'),
('GANESH P', '6382808255', 'gganesh8511@gmail.com', 'pothole', 'Available'),
('GLARA A', '9600539780', 'glaraamose7@gmail.com', 'pothole', 'Available'),
('GUNA CHANDIRAN D', '8072772365', 'gunachandran367@gmail.com', 'pothole', 'Available'),
('HARAN S S', '9698835333', 'ssharan1408@gmail.com', 'pothole', 'Available'),
('HEMAVARSHINI S', '9042646522', 'constantsmilerhemu04@gmail.com', 'pothole', 'Available'),
('KABILESH V', '8778853952', 'kabileshv53@gmail.com', 'pothole', 'Available'),
('KAVIKUMAR V', '9363377005', 'kavikumarvijay1732020@gmail.com', 'pothole', 'Available'),
('KAVIYA SRI V', '9629433602', 'vkaviyasri82@gmail.com', 'pothole', 'Available'),
('LOKESH T', '9360192195', 'lokeshtheerthalingam3040@gmail.com', 'pothole', 'Available'),
('MANIKANDAPRABHU R', '9361828355', 'manikandanrenganathan25@gmail.com', 'pothole', 'Available'),
('MEYREDHA B P', '7904982648', 'meyredhapanneer2004@gmail.com', 'pothole', 'Available'),
('MIRUDHULA J', '9092110145', 'mirudhulajeyakumar2005@gmail.com', 'pothole', 'Available');

-- DRAINAGE DEPARTMENT
INSERT INTO public.employees (name, phone, email, department, availability_status) VALUES
('MOHAMMED MUSTHAKIM R', '8072059533', 'tamillion29@gmail.com', 'drainage', 'Available'),
('MONISHA R', '9488572029', 'MONISHAR2255@gmail.com', 'drainage', 'Available'),
('NAJIH R', '9597425892', 'najih.banu54@gmail.com', 'drainage', 'Available'),
('NAVEEN KUMAR D', '8667242517', 'naveenn7850@gmail.com', 'drainage', 'Available'),
('OVIYA S', '8438693371', 'cmuniyasamy99@gmail.com', 'drainage', 'Available'),
('PRAGADEESHWARAN D', '9047165686', 'pragadeesh123sel@gmail.com', 'drainage', 'Available'),
('PRAKASH M', '8870275273', 'prakashmurugesan1826@gmail.com', 'drainage', 'Available'),
('RAGUL A', '8778389422', 'ragulamaresan51@gmail.com', 'drainage', 'Available'),
('RAKESH M', '7904115465', 'smanirakesh13@gmail.com', 'drainage', 'Available'),
('RATCHIKA R', '9360093607', 'ratchikaraja122@gmail.com', 'drainage', 'Available'),
('SABARIRAM S', '9003701031', 'sabaricrush908@gmail.com', 'drainage', 'Available'),
('SABITHA R J', '9952192377', 'sabitharobert2311@gmail.com', 'drainage', 'Available'),
('SASANK T', '9514219881', 'sasank2612@gmail.com', 'drainage', 'Available');

-- WATER_SUPPLY DEPARTMENT
INSERT INTO public.employees (name, phone, email, department, availability_status) VALUES
('SATHEESH B', '6374740353', 'sashsatheesh0353@gmail.com', 'water_supply', 'Available'),
('SELVABHARATHI R', '7810083808', 'thalapathiselva391@gmail.com', 'water_supply', 'Available'),
('SHANMUGANATHAN T', '6385923835', 'santtt8973@gmail.com', 'water_supply', 'Available'),
('SNEHA M', '9497339153', 'snehamurugesan517@gmail.com', 'water_supply', 'Available'),
('SOUNDARYA K', '8220393454', 'kaci2933@gmail.com', 'water_supply', 'Available'),
('SUDHARSAN M M', '9080470049', 'sudharsanchinna344@gmail.com', 'water_supply', 'Available'),
('SWETHA G', '9940777355', 'swethakrish2407@gmail.com', 'water_supply', 'Available'),
('THIRU SENTHIL MURUGAN M', '9344776818', 'senthilmuthaiah2604@gmail.com', 'water_supply', 'Available'),
('VISHNU PRIYA M', '7010318944', 'vishnu235priya@gmail.com', 'water_supply', 'Available'),
('YUVA RANI M', '9940953799', 'yuva0036@gmail.com', 'water_supply', 'Available'),
('YUVARAJ M', '6380903245', 'smartyuvi161@gmail.com', 'water_supply', 'Available'),
('YUVARAJA V', '7604996089', 'v.yuvaraja2005@gmail.com', 'water_supply', 'Available'),
('LAKSHIKA S', '6379878736', 'slakshika2004@gmail.com', 'water_supply', 'Available');
