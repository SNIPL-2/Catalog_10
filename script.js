const DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6NvfwkfCNg4TC0jrlrfiqdXA4UyOGhDdm9cJs2tkJxKpqoDa2OjHulev5O6avSKhMGWAP6utFs-MD/pub?gid=0&single=true&output=csv";
const IMAGE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6NvfwkfCNg4TC0jrlrfiqdXA4UyOGhDdm9cJs2tkJxKpqoDa2OjHulev5O6avSKhMGWAP6utFs-MD/pub?gid=676833393&single=true&output=csv";
const CATEGORY_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6NvfwkfCNg4TC0jrlrfiqdXA4UyOGhDdm9cJs2tkJxKpqoDa2OjHulev5O6avSKhMGWAP6utFs-MD/pub?gid=2136776722&single=true&output=csv";

const PLACEHOLDER_IMG = "https://placehold.co/300x300/EEF1F5/8A93A1?text=No+Image";
const WHATSAPP_NUMBER = "917986297302";

let allData = [];
let imageMap = {};
let categoryImageMap = {};
let currentCategory = null;
let currentItemCode = null;

const catalogueEl = () => document.getElementById("catalogue");
const breadcrumbEl = () => document.getElementById("breadcrumb");

/* ---------- Helpers ---------- */
function safe(val) {
  return (val || "").toString().trim();
}

function escapeHtml(str) {
  return safe(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imgWithFallback(src, alt, cls) {
  const safeSrc = src || PLACEHOLDER_IMG;
  return `<img src="${safeSrc}" alt="${escapeHtml(alt)}" class="${cls}" loading="lazy"
    onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';" />`;
}

function setQueryParam(params) {
  const url = new URL(window.location.href);
  url.search = "";
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  window.history.replaceState({}, "", url);
}

/* ---------- Load Data ---------- */
function loadData() {
  catalogueEl().innerHTML = `
    <div class="state state-loading">
      <div class="spinner" aria-hidden="true"></div>
      <p>Loading catalogue…</p>
    </div>`;

  Promise.all([
    fetch(DATA_URL).then(res => { if (!res.ok) throw new Error("data"); return res.text(); }),
    fetch(IMAGE_URL).then(res => { if (!res.ok) throw new Error("images"); return res.text(); }),
    fetch(CATEGORY_URL).then(res => { if (!res.ok) throw new Error("categories"); return res.text(); })
  ])
    .then(([dataText, imageText, categoryText]) => {
      allData = Papa.parse(dataText, { header: true }).data
        .filter(row => safe(row["Item Code"]) && safe(row["Category"]))
        .map(row => ({ ...row, Category: safe(row["Category"]) }));

      const imageParsed = Papa.parse(imageText, { header: true }).data;
      imageParsed.forEach(row => {
        const code = safe(row["Item Code"]);
        if (code && safe(row["Image URL"])) imageMap[code] = safe(row["Image URL"]);
      });

      const categoryParsed = Papa.parse(categoryText, { header: true }).data;
      categoryParsed.forEach(row => {
        const cat = safe(row["Category"]);
        if (cat && safe(row["Image URL"])) categoryImageMap[cat] = safe(row["Image URL"]);
      });

      routeFromUrl();
    })
    .catch(() => {
      catalogueEl().innerHTML = `
        <div class="state state-error">
          <i class="fas fa-triangle-exclamation" aria-hidden="true" style="font-size:24px;"></i>
          <p>Couldn't load the catalogue. Please check your connection and try again.</p>
          <button class="retry-btn" onclick="loadData()">Retry</button>
        </div>`;
    });
}

/* Deep-link support: ?item=CODE&category=NAME or ?category=NAME or ?q=term */
function routeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const item = params.get("item");
  const category = params.get("category");
  const q = params.get("q");

  if (item && category) {
    currentCategory = category;
    renderItemDetail(item, { pushUrl: false });
  } else if (category) {
    renderItems(category, { pushUrl: false });
  } else if (q) {
    document.getElementById("searchInput").value = q;
    performSearch({ pushUrl: false });
  } else {
    renderCategories({ pushUrl: false });
  }
}

/* ---------- Breadcrumb Navigation ---------- */
function renderBreadcrumb(level) {
  let html = "";
  if (level === "category") {
    html = `<button class="back-btn" onclick="renderCategories()"><i class="fas fa-arrow-left"></i> Categories</button>`;
  } else if (level === "item") {
    html = `<button class="back-btn" onclick="renderItems('${escapeHtml(currentCategory)}')"><i class="fas fa-arrow-left"></i> ${escapeHtml(currentCategory)}</button>`;
  } else if (level === "search") {
    html = `<button class="back-btn" onclick="clearSearch()"><i class="fas fa-arrow-left"></i> Home</button>`;
  }
  breadcrumbEl().innerHTML = html;
}

/* Make a card element keyboard accessible */
function makeCard(className, innerHtml, onActivate) {
  const div = document.createElement("div");
  div.className = className;
  div.innerHTML = innerHtml;
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  div.addEventListener("click", onActivate);
  div.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  });
  return div;
}

/* ---------- Home Page (Categories) ---------- */
function renderCategories(opts = { pushUrl: true }) {
  currentCategory = null;
  currentItemCode = null;
  renderBreadcrumb("");
  if (opts.pushUrl) setQueryParam({});

  const container = catalogueEl();
  container.innerHTML = `<h2>Product Categories</h2><div class="grid"></div>`;
  const grid = container.querySelector(".grid");

  const categories = [...new Set(allData.map(item => item.Category))].sort();

  if (categories.length === 0) {
    grid.parentElement.innerHTML += `<div class="no-results"><i class="fas fa-box-open"></i><p>No categories found.</p></div>`;
    return;
  }

  categories.forEach(cat => {
    const catImg = categoryImageMap[cat];
    const card = makeCard(
      "card category-card",
      `<div class="card-image-wrap">${imgWithFallback(catImg, cat, "card-image")}</div>
       <div class="card-title">${escapeHtml(cat)}</div>`,
      () => renderItems(cat)
    );
    grid.appendChild(card);
  });
}

/* ---------- Category Page (Items) ---------- */
function renderItems(category, opts = { pushUrl: true }) {
  currentCategory = category;
  renderBreadcrumb("category");
  if (opts.pushUrl) setQueryParam({ category });

  const container = catalogueEl();
  container.innerHTML = `<h2>${escapeHtml(category)}</h2><div class="grid"></div>`;
  const grid = container.querySelector(".grid");

  const items = [...new Set(
    allData.filter(row => row.Category === category).map(row => safe(row["Item Code"]))
  )];

  if (items.length === 0) {
    container.innerHTML += `<div class="no-results"><i class="fas fa-box-open"></i><p>No items in this category yet.</p></div>`;
    return;
  }

  items.forEach(code => {
    const item = allData.find(row => safe(row["Item Code"]) === code);
    const itemName = safe(item && item["Item Name"]);
    const img = imageMap[code];
    const card = makeCard(
      "card",
      `<div class="card-image-wrap">${imgWithFallback(img, itemName || code, "card-image")}</div>
       <div class="card-title">${escapeHtml(itemName || code)}</div>
       <div class="card-code">Code: ${escapeHtml(code)}</div>`,
      () => renderItemDetail(code)
    );
    grid.appendChild(card);
  });
}

/* ---------- Item Detail Page ---------- */
function renderItemDetail(itemCode, opts = { pushUrl: true }) {
  currentItemCode = itemCode;
  renderBreadcrumb("item");
  if (opts.pushUrl) setQueryParam({ category: currentCategory, item: itemCode });

  const container = catalogueEl();

  const entries = allData.filter(
    row => safe(row["Item Code"]) === itemCode && row.Category === currentCategory
  );

  if (entries.length === 0) {
    container.innerHTML = `<div class="no-results"><i class="fas fa-circle-exclamation"></i><p>Item not found.</p></div>`;
    return;
  }

  const first = entries[0];
  const itemName = safe(first["Item Name"]);
  const img = imageMap[itemCode];

  const uniqueVariants = entries.reduce((unique, entry) => {
    const vCode = safe(entry["Variant Code"]);
    if (!unique.some(e => safe(e["Variant Code"]) === vCode)) unique.push(entry);
    return unique;
  }, []);

  const rows = uniqueVariants.map(entry => {
    const variantCode = safe(entry["Variant Code"]);
    const description = safe(entry["Description"]);
    const price = safe(entry["Price/Unit"]);
    const unit = safe(entry["Unit"]);
    const moq = safe(entry["MOQ"]);
    const msg = encodeURIComponent(
      `Hi, I'm interested in this tool:\nItem: ${itemName}\nCategory: ${currentCategory}\nVariant Code: ${variantCode}\nDescription: ${description}\nPrice: ${price}`
    );
    return `
      <tr>
        <td>${escapeHtml(variantCode)}</td>
        <td>${escapeHtml(description)}</td>
        <td>${escapeHtml(price)}</td>
        <td>${escapeHtml(unit)}</td>
        <td>${escapeHtml(moq)}</td>
        <td class="wa-cell"><a class="wa-link" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP_NUMBER}?text=${msg}"><i class="fab fa-whatsapp"></i> Chat</a></td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="item-header">
      <h2>${escapeHtml(itemName)}</h2>
      <p class="meta">
        <span><strong>Item Code:</strong> ${escapeHtml(first["Item Code"])}</span>
        <span><strong>HSN Code:</strong> ${escapeHtml(first["HSN Code"])}</span>
      </p>
      <div class="detail-image-wrap">${imgWithFallback(img, itemName || itemCode, "detail-image")}</div>
      <p class="specs">${escapeHtml(first["Specs"])}</p>
    </div>
    <h3 class="variants-heading">Available Variants</h3>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Variant Code</th>
            <th>Description</th>
            <th>Price/Unit</th>
            <th>Unit</th>
            <th>MOQ</th>
            <th>Enquire</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Global Search ---------- */
function performSearch(opts = { pushUrl: true }) {
  const query = safe(document.getElementById("searchInput").value).toLowerCase();
  document.getElementById("clearBtn").hidden = !query;
  if (!query) { renderCategories(); return; }

  if (opts.pushUrl) setQueryParam({ q: query });

  const results = allData.filter(row =>
    safe(row["Item Code"]).toLowerCase().includes(query) ||
    safe(row["Item Name"]).toLowerCase().includes(query) ||
    row.Category.toLowerCase().includes(query) ||
    safe(row["Specs"]).toLowerCase().includes(query) ||
    safe(row["Description"]).toLowerCase().includes(query)
  );

  renderBreadcrumb("search");
  const container = catalogueEl();
  container.innerHTML = `<h2>Search results for "${escapeHtml(query)}"</h2><div class="grid"></div>`;
  const grid = container.querySelector(".grid");

  const uniqueCodes = [...new Set(results.map(row => safe(row["Item Code"])))];

  if (uniqueCodes.length === 0) {
    container.innerHTML += `<div class="no-results"><i class="fas fa-magnifying-glass"></i><p>No items matched your search.</p></div>`;
    return;
  }

  uniqueCodes.forEach(code => {
    const match = results.find(row => safe(row["Item Code"]) === code);
    const itemName = safe(match && match["Item Name"]);
    const img = imageMap[code];
    const card = makeCard(
      "card",
      `<div class="card-image-wrap">${imgWithFallback(img, itemName || code, "card-image")}</div>
       <div class="card-title">${escapeHtml(itemName || code)}</div>
       <div class="card-code">${escapeHtml(match.Category)}</div>`,
      () => { currentCategory = match.Category; renderItemDetail(code); }
    );
    grid.appendChild(card);
  });
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  document.getElementById("clearBtn").hidden = true;
  renderCategories();
}

/* ---------- Wire up events ---------- */
let searchDebounce;
document.getElementById("searchInput").addEventListener("input", e => {
  document.getElementById("clearBtn").hidden = !e.target.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => performSearch(), 300);
});
document.getElementById("searchInput").addEventListener("keypress", e => {
  if (e.key === "Enter") { clearTimeout(searchDebounce); performSearch(); }
});
document.getElementById("clearBtn").addEventListener("click", clearSearch);
window.addEventListener("popstate", routeFromUrl);

loadData();
