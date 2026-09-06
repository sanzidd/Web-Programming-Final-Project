import requests

BASE_URL = 'http://localhost:5001/api'

# 1. Register a student
print("Registering student...")
r = requests.post(f"{BASE_URL}/students/register", json={
    "name": "Test Student",
    "email": "student@ruet.ac.bd",
    "roll": "1903001",
    "password": "password123",
    "series": "19"
})
print("Status:", r.status_code)
print("Response:", r.json())

# 2. Login student
print("\nLogging in student...")
r = requests.post(f"{BASE_URL}/students/login", json={
    "roll": "1903001",
    "password": "password123"
})
print("Status:", r.status_code)
print("Response:", r.json())

# 3. Register a teacher
print("\nRegistering teacher...")
r = requests.post(f"{BASE_URL}/teacher-auth/register", json={
    "name": "Test Teacher",
    "email": "teacher@ruet.ac.bd",
    "password": "password123",
    "designation": "Professor"
})
print("Status:", r.status_code)
print("Response:", r.json())

# 4. Login teacher
print("\nLogging in teacher...")
r = requests.post(f"{BASE_URL}/teacher-auth/login", json={
    "email": "teacher@ruet.ac.bd",
    "password": "password123"
})
print("Status:", r.status_code)
print("Response:", r.json())
