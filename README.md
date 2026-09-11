# Leetcode Companywise Interview Questions

![leetcode-companywise-interview-questions](https://socialify.git.ci/snehasishroy/leetcode-companywise-interview-questions/image?description=1&font=JetBrains+Mono&forks=1&language=1&name=1&owner=1&pattern=Solid&stargazers=1&theme=Dark)

This repository contains Company Wise Questions of LeetCode, categorized based on their recency (Last 30 Days, Last 3 Months, Last 6 Months, Last 1 Year, All), alongside an interactive Next.js web application to track and solve them.

---

## 📁 Repository Architecture

```
Leetcode-companion/
├── webapp/            # 🌐 Interactive Next.js tracker application & SQLite database
├── question-lists/    # 📊 650+ company folders containing CSV interview problem sets
├── scraper/           # 🕷️ Java Selenium scraper to update question datasets
├── run-backend.bat    # ⚡ Windows one-click script to start the web application
├── run-webapp.bat     # ⚡ Alias launcher for the web application
└── README.md
```

### 🚀 Running the Web App

Double-click `run-backend.bat` (or `run-webapp.bat`), or run:
```bash
cd webapp
npm run dev
```
Then visit **http://localhost:3000** in your browser.

---

## If you have LeetCode Premium and want to contribute back

* If you have LeetCode premium and want to contribute back, open the `scraper/` directory and setup the Java Project in your IDE.
* Code to scrape the solutions is in `scraper/src/main/java/Scraper.java`.
* By default, the selenium browser will open in Edge.
* If the selenium browser does not open, you might need to update *selenium-java* to the latest version because the
  older versions of Selenium java can be incompatible with the existing version of Edge.
  Run the scraper after filling in your UserName and Password [here](https://github.com/snehasishroy/leetcode-companywise-interview-questions/blob/master/src/main/java/Scraper.java#L17), without which the code won't work.
* Delete the existing folders so the new files does not conflict.
* In case you get a timeout during page reloads, do increase the default timeout value
  set [here](https://github.com/snehasishroy/leetcode-companywise-interview-questions/blob/master/src/main/java/Scraper.java#L19)

* Once the code is finished (which should take ~3 hours), create a Pull Request and I will be happy to merge it. Thank
  you for your contribution :)



## Happy LeetCoding. May the force be with you.


