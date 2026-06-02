const res = await fetch("http://localhost:3001/api/v1/site/writing");
const text = await res.text();
const json = JSON.parse(text);
const books = json.data?.books ?? [];
const articles = json.data?.articles ?? [];
console.log("status", res.status, "bytes", text.length, "articles", articles.length, "books", books.length);
if (books[0]) console.log("book keys", Object.keys(books[0]));
