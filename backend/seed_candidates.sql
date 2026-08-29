-- Candidate seed data, generated from src/data.ts (18 candidates).
-- Regenerate rather than hand-editing, so the DB stays in step with the frontend seed.
-- Idempotent: re-running updates existing rows instead of failing.

INSERT INTO candidates (id, name, nickname, department, academic_year, category, bio, talent, photo, is_active)
VALUES
  ('king-1', 'Daung', 'Alvin', 'Mechanical Engineering', 'First Year', 'king', 'From Meiktila, Studied at BEHS 1 Meiktila, Height:1.8m', 'Good at problem solving', 'https://i.pinimg.com/originals/cb/70/66/cb7066f2d6117366f7a14bb9f4401202.jpg', TRUE),
  ('king-2', 'Paing Takhon', 'Jack', 'Architecture', 'First Year', 'king', 'From Kawthoung, Studied at BEHS 1 Khamaukgyi, Height:1.88m', 'Presentation skills', 'https://tse2.mm.bing.net/th/id/OIP.Nc-LYkRZ74hlflLK_afaZQHaLd?r=0&rs=1&pid=ImgDetMain&o=7&rm=3', TRUE),
  ('king-3', 'Kaung Myat San', 'Harry', 'Civil Engineering', 'First Year', 'king', 'From Yangon, Studied at BEHS 2 Dagon, Height: 1.78m', 'Robotics & Community Service', 'https://tse4.mm.bing.net/th/id/OIP.ap7Heh-ngs8oS_UwEzvo1QHaLG?r=0&rs=1&pid=ImgDetMain&o=7&rm=3', TRUE),
  ('queen-1', 'Hsaung Wutyee May', 'Abby', 'Electronic Engineering', 'First Year', 'queen', 'From Yangon, Studied at BEHS 2 Bahan, Height: 1.68m', 'Teamwork,Leadership', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgtE8-9kMW_XrzDDhXF47ogCJ6r5SAS2A_w094t4gYKV2AKYhichvL5Xa4tESh_in5V8fTF736OvGvlTtcBZYtN1EtLdLsg64JvLfeRfc4RTIaFTt3qKRExCcDser10LHFtcZgl-23hqu2ywAwwB6wUnJm0pJJhQTygR65Lld2kLUpdPvaxWm4XRQ011w/s2048/308462275_654117296072973_1024788347621804352_n.jpg', TRUE),
  ('queen-2', 'Poe Mamhe Thar', 'Priscy', 'Electrical power', 'First Year', 'queen', 'From Yangon, Studied at BEHS 2 Bahan, Height: 1.68m', 'Leadership and critical thinking under pressure', 'https://i.pinimg.com/736x/51/6c/1e/516c1e409248036c08dac4602348c2ea.jpg', TRUE),
  ('queen-3', 'May Myint Mo', 'NY', 'Mechatronic Engineering', 'First Year', 'queen', 'From Yangon, Studied at BEHS 2 Sanchaung, Height: 1.63m', 'Teamwork and computer drafting', 'https://tse4.mm.bing.net/th/id/OIP.7gIP_buX1pMer1afQsMbaAHaLM?r=0&rs=1&pid=ImgDetMain&o=7&rm=3', TRUE),
  ('style-1', 'Honey Nway Oo', 'Honey', 'Mechatronics Engineering', 'First Year', 'style', 'From Yangon, Studied at BEHS 2 Sanchaung, Height: 1.56m', 'Fashion Design & Personal Styling', '/Honey.jpg', TRUE),
  ('style-2', 'Khin Wint Wah', 'Wint Wah', 'Electrical Engineering', 'First Year', 'style', 'From Yangon, Studied at BEHS 2 Kamayut, Height: 173cm.', 'Brand Identity & Cultural Fashion', '/khinwintwah.jpg', TRUE),
  ('style-3', 'Wutt Hmone Shwe Yi', 'Kit Kit', 'Electrical Power Engineering', 'First Year', 'style', 'From Yangon, Studied at BEHS 2 Kamayut, Height: 163cm', 'Aesthetic Design & Visual Art', '/KitKit.jpg', TRUE),
  ('smart-1', 'Tayza lin Young', 'Tayza', 'Computer Science and Information Technology', 'First Year', 'smart', 'From Yangon, Studied at BEHS 2 Latha, Height: 183cm.', 'Artificial Intelligence & Research', '/Tazya.jpg', TRUE),
  ('smart-2', 'Nyein Thaw', 'NT', 'Mechatronics Engineering', 'First Year', 'smart', 'From Yangon, Studied at BEHS 2 Dagon, Height: 178cm.', 'Pure Mathematics & Problem Solving', '/nyein.jpg', TRUE),
  ('smart-3', 'Shein Tin Htoo', 'Shein', 'Mechanical Engineering', 'First Year', 'smart', 'From Yangon, Studied at BEHS 2 Dagon, Height: 183m', 'Physics & Academic Competition', '/Shein.jpg', TRUE),
  ('popular_man-1', 'Alinnyaung', 'Light', 'Computer Science and Information Technology', 'First Year', 'popular_man', 'From Mandalay, Studied at a monastic school, Height: 178cm.', 'Artificial Intelligence & Research', '/popular1.jpg', TRUE),
  ('popular_man-2', 'Henary San', 'Henry', 'Mechatronics Engineering', 'First Year', 'popular_man', 'From Mandalay, Studied at BEHS 14 Mandalay, Height: 183cm.', 'Pure Mathematics & Problem Solving', '/popular2.jpg', TRUE),
  ('popular_man-3', 'Shin Mwe La', 'SML', 'Mechanical Engineering', 'First Year', 'popular_man', 'From Yangon, Studied at BEHS 2 Sanchaung, Height: 173cm', 'Physics & Academic Competition', '/popular3.jpg', TRUE),
  ('popular_woman-1', 'May Grace', 'May', 'Mechatronics Engineering', 'First Year', 'popular_woman', 'Born in Australia, Height: 175cm', 'Fashion Design & Personal Styling', '/popu-w1.jpg', TRUE),
  ('popular_woman-2', 'Thae Su Nyein', 'Thae Thae', 'Electrical Engineering', 'First Year', 'popular_woman', 'From Yangon, Studied at BEHS 2 Sanchaung, Height: 175cm', 'Brand Identity & Cultural Fashion', '/popu-w2.jpg', TRUE),
  ('popular_woman-3', 'Lu Hpring', 'Lu', 'Electrical Power Engineering', 'First Year', 'popular_woman', 'From Myitkyina, Studied at BEHS 1,Myitkyina, Height: 168cm', 'Aesthetic Design & Visual Art', '/popu-w3.jpg', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  nickname = EXCLUDED.nickname,
  department = EXCLUDED.department,
  academic_year = EXCLUDED.academic_year,
  category = EXCLUDED.category,
  bio = EXCLUDED.bio,
  talent = EXCLUDED.talent,
  photo = EXCLUDED.photo,
  is_active = EXCLUDED.is_active;
