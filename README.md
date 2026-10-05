\# DOCVYN



\*\*AI-Powered Document Analysis \& Question Answering Assistant\*\*



DOCVYN is a web application that allows users to upload documents and interact with their content using AI. It extracts text from PDF, DOCX, and TXT files, provides AI-generated document analysis, and lets users ask questions about their documents.



\## Features



\* Upload PDF, DOCX, and TXT documents

\* Extract and process document text

\* Generate AI-based document analysis

\* Ask questions about uploaded documents

\* View and manage uploaded documents

\* Store document data using MongoDB



\## Tech Stack



\* \*\*Frontend:\*\* HTML, CSS, JavaScript, EJS

\* \*\*Backend:\*\* Node.js, Express.js

\* \*\*Database:\*\* MongoDB Atlas

\* \*\*AI:\*\* Google Gemini API

\* \*\*Libraries:\*\* Multer, Mammoth, PDF parsing



\## How It Works



1\. Upload a document.

2\. DOCVYN extracts its text.

3\. The document is stored and managed through MongoDB.

4\. Gemini analyzes the document.

5\. Users can ask questions and receive answers based on the document.



\## Run Locally



```bash

git clone https://github.com/MahekChoudhary/DOCVYN.git

cd DOCVYN

npm install

```



Create a `.env` file:



```env

GEMINI\_API\_KEY=your\_api\_key

MONGO\_URI=your\_mongodb\_connection\_string

```



Start the server:



```bash

node server.js

```



Open:



```text

http://localhost:3000

```



\## Future Scope



\* Multi-document interaction

\* Improved document search

\* User authentication

\* Cloud deployment

\* Support for additional document formats



\## Author



\*\*Mahek Choudhary\*\*

B.Tech Information Technology — UIT RGPV, Bhopal



