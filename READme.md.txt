## Setup & Installation

##1. Prerequisites
Ensure you have the following installed:

Node.js (v16.x or higher)
PostgreSQL/Dbeaver (If you wish to run the database locally)

##2. Environment Setup
The project requires several environment variables to function (Database, Email, Cloud Storage).

Locate the .env file in the root directory. I have provided my active API keys in the submitted .env file for your convenience during evaluation.

##3. Database Initialization
You have two options to view the database:

Option A (Cloud): 
The system is currently connected to Neon (PostgreSQL Cloud). No setup is required as long as you have internet access.

Option B (Local): If you prefer a local database:
Create a new database in your PostgreSQL (FYP2.sql).
Import the provided FYP2.sql file.
Update the DATABASE_URL in the .env file to point to your local host.

##4. Installing Dependencies
Open your terminal in the project root folder and run:

npm install

##5. Launching the Application
To start the server, run:

nodemon app.js\

##The application is deployed on Render: https://project-shbe.onrender.com
##The code is published on Github:https://github.com/JING050104/Project