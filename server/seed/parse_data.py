import os
import re
import json

base_dir = '/Users/sanzid/.gemini/antigravity/brain/15b539a9-3115-4af7-b6dc-fe2881b57fbd/.system_generated/steps/'

departments = {
    'CSE': 'Computer Science & Engineering',
    'EEE': 'Electrical & Electronic Engineering',
    'ECE': 'Electrical & Computer Engineering',
    'ETE': 'Electronics & Telecommunication Engineering',
    'CE': 'Civil Engineering',
    'ARCH': 'Architecture',
    'URP': 'Urban & Regional Planning',
    'BECM': 'Building Engineering & Construction Management',
    'ME': 'Mechanical Engineering',
    'IPE': 'Industrial & Production Engineering',
    'CME': 'Ceramic & Metallurgical Engineering',
    'MTE': 'Mechatronics Engineering',
    'MSE': 'Materials Science & Engineering',
    'CHE': 'Chemical Engineering',
    'CHEM': 'Chemistry',
    'MATH': 'Mathematics',
    'PHY': 'Physics',
    'HUM': 'Humanities'
}

data = {}

for folder in os.listdir(base_dir):
    folder_path = os.path.join(base_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    md_path = os.path.join(folder_path, 'content.md')
    if not os.path.exists(md_path):
        continue
        
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find Title
    title_match = re.search(r'Title:\s*([A-Z]+)-', content)
    if not title_match:
        continue
        
    dept_code = title_match.group(1).strip()
    if dept_code not in departments:
        continue
        
    lines = content.split('\n')
    current_designation = "Lecturer"
    teachers = []
    seen = set()
    
    for line in lines:
        line = line.strip()
        if line.startswith('#### '):
            desig = line.replace('####', '').strip()
            if desig.lower() != 'head':
                current_designation = desig
        elif line.startswith('### ['):
            match = re.search(r'### \[(.*?)\]', line)
            if match:
                name = match.group(1)
                # Ignore duplicate names (sometimes listed twice)
                if name not in seen:
                    teachers.append({
                        'name': name,
                        'designation': current_designation,
                        'courses': [],
                        'email': name.lower().replace(' ', '').replace('.', '') + '@' + dept_code.lower() + '.ruet.ac.bd'
                    })
                    seen.add(name)
                    
    data[dept_code] = teachers

out_path = '/Users/sanzid/Desktop/WEB PROGRAMMING PROJECT/server/seed/teachers_data.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
    
print(f"Parsed {len(data)} departments. Saved to {out_path}")
