// Builds preview/index.html from the real app's index.html with the new Padel Nation look:
//   node preview/make.js
// The real app is never changed; the preview uses sample data (sample-data.js) and no login.

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let s = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");

const swap = (from, to) => {
  if (!s.includes(from)) throw new Error("Not found in index.html: " + from.slice(0, 60));
  s = s.replace(from, to);
};

// Sample data instead of Firebase; no offline worker; files one folder up.
swap('<script type="module" src="firebase.js"></script>', '<script type="module" src="sample-data.js"></script>');
s = s.replace(/<script>\n\/\/ Saves the app on the device[\s\S]*?<\/script>\n/, "");
swap('href="manifest.webmanifest"', 'href="../manifest.webmanifest"');
swap('href="icon-192.png"', 'href="../icon-192.png"');
swap('href="icon-180.png"', 'href="../icon-180.png"');
s = s.replace(/src="logo\.png"/g, 'src="../logo.png"');
swap("<title>Padel Nation · Court Daily Income</title>", "<title>Padel Nation · Design preview</title>");

// Old aurora colours inside the app's own styles → logo colours and orange.
const styleStart = s.indexOf("<style>", s.indexOf("img { max-width: 100%; }"));
const styleEnd = s.indexOf("</style>", styleStart);
let css = s.slice(styleStart, styleEnd);
const colours = [
  ["94,242,184", "240,122,44"], ["53,240,166", "240,122,44"], ["34,195,230", "212,86,28"],
  ["138,107,255", "35,58,85"], ["255,95,174", "181,211,52"], ["120,255,170", "181,211,52"],
  ["#b8ffe0", "#e4f3a8"], ["#eafff3", "#f4f9e2"], ["#eafff5", "#f4f9e2"], ["#7dffb6", "#c9e265"], ["#2fd47f", "#9cbf2a"]
];
for (const [a, b] of colours) css = css.split(a).join(b);
s = s.slice(0, styleStart) + css + s.slice(styleEnd);

// New fonts and the theme, after the app's styles so they win; the moving court at the end.
swap("</head>", `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="theme.css">
</head>`);
swap("</body>", '<script src="court.js"></script>\n</body>');

fs.writeFileSync(path.join(__dirname, "index.html"), s);
console.log("preview/index.html written");
