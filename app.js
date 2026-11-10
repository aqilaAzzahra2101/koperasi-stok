const STORAGE_KEY = "stokkita-data-v1";
const state = loadState();
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});
const productForm = document.querySelector("#product-form");
const movementForm = document.querySelector("#movement-form");
const productSelect = document.querySelector("#movement-product");
const movementType = document.querySelector("#movement-type");
const movementPrice = document.querySelector("#movement-price");
const movementQuantity = document.querySelector("#movement-quantity");
const movementDate = document.querySelector("#movement-date");
const historyFilter = document.querySelector("#history-filter");
const toast = document.querySelector("#toast");
const movementSearch = document.querySelector("#movement-search");
const productSubmit = document.querySelector("#product-submit");
const productCancel = document.querySelector("#product-cancel");
const productFormTitle = document.querySelector("#product-form-title");
const productStockLabel = document.querySelector('label[for="opening-stock"]');
let toastTimer;
let editingProductId = null;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { products: [], movements: [] };
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.movements)) {
      throw new Error("Format data stok tidak valid.");
    }
    return parsed;
  } catch (error) {
    console.error("Gagal membaca data stok:", error);
    return { products: [], movements: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function addMovement(product, type, quantity, price, date) {
  state.movements.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: product.id,
    productName: product.name,
    type,
    quantity,
    price,
    date
  });
}

function render() {
  const totalQuantity = state.products.reduce((sum, product) => sum + product.stock, 0);
  const totalValue = state.products.reduce((sum, product) => sum + product.stock * product.price, 0);
  document.querySelector("#summary-products").textContent = state.products.length;
  document.querySelector("#summary-quantity").textContent = new Intl.NumberFormat("id-ID").format(totalQuantity);
  document.querySelector("#summary-value").textContent = rupiah.format(totalValue);

  const searchTerm = document.querySelector("#search").value.trim().toLocaleLowerCase("id");
  const visibleProducts = state.products.filter(product =>
    `${product.name} ${product.category}`.toLocaleLowerCase("id").includes(searchTerm)
  );
  document.querySelector("#inventory-rows").innerHTML = visibleProducts.map(product => `
    <tr>
      <td class="table-cell-strong">${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category || "—")}</td>
      <td>${rupiah.format(product.price)}</td>
      <td><span class="status-badge ${product.stock === 0 ? "status-out" : "status-in"}">${product.stock}</span></td>
      <td>${rupiah.format(product.stock * product.price)}</td>
      <td>
        <div class="table-actions">
          <button class="table-button" type="button" data-add-stock="${escapeHtml(product.id)}">Tambah 1 stok</button>
          <button class="table-button" type="button" data-edit-product="${escapeHtml(product.id)}">Edit</button>
          <button class="table-button delete-button" type="button" data-delete-product="${escapeHtml(product.id)}">Hapus</button>
        </div>
      </td>
    </tr>
  `).join("");
  document.querySelector("#inventory-empty").textContent = state.products.length
    ? "Tidak ada barang yang cocok dengan pencarian."
    : "Belum ada barang. Tambahkan barang untuk memulai.";
  document.querySelector("#inventory-empty").hidden = visibleProducts.length > 0;

  const selectedProductId = productSelect.value;
  const movementTerm = movementSearch.value.trim().toLocaleLowerCase("id");
  const movementProducts = state.products.filter(product =>
    product.name.toLocaleLowerCase("id").includes(movementTerm)
  );
  productSelect.innerHTML = '<option value="">Pilih barang</option>' +
    movementProducts.map(product =>
      `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (stok ${product.stock})</option>`
    ).join("");
  if (movementProducts.some(product => product.id === selectedProductId)) {
    productSelect.value = selectedProductId;
  }

  const filteredMovements = state.movements.filter(movement =>
    historyFilter.value === "semua" || movement.type === historyFilter.value
  );
  const latestMovements = [...filteredMovements]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 30);
  document.querySelector("#history-rows").innerHTML = latestMovements.map(movement => `
    <tr>
      <td>
        <strong class="product-name">${escapeHtml(movement.productName)}</strong>
        <span class="date-label">${formatDate(movement.date)}</span>
      </td>
      <td><span class="status-badge ${movement.type === "masuk" ? "status-in" : "status-out"}">${movement.type === "masuk" ? "Masuk" : "Keluar"}</span></td>
      <td>${movement.quantity}</td>
      <td>${rupiah.format(movement.price * movement.quantity)}</td>
    </tr>
  `).join("");
  document.querySelector("#history-empty").textContent = filteredMovements.length
    ? "Tidak ada transaksi pada kategori ini."
    : "Belum ada transaksi.";
  document.querySelector("#history-empty").hidden = latestMovements.length > 0;
  updateSelectedProduct();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function updateSelectedProduct() {
  const product = state.products.find(item => item.id === productSelect.value);
  const isOutgoing = movementType.value === "keluar";
  movementPrice.readOnly = isOutgoing;
  movementPrice.value = product ? product.price : "";
  movementQuantity.max = product && isOutgoing ? product.stock : "";
  document.querySelector("#stock-hint").textContent = product
    ? `Stok tersedia: ${product.stock}`
    : "Stok tersedia: —";
  document.querySelector("#price-hint").textContent = isOutgoing
    ? "Harga barang saat ini"
    : "Harga masuk akan menjadi harga terkini barang";
}

productForm.addEventListener("submit", event => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const name = String(formData.get("name")).trim();
  const category = String(formData.get("category")).trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("quantity"));
  const date = String(formData.get("date"));

  if (state.products.some(product =>
    product.id !== editingProductId &&
    product.name.toLocaleLowerCase("id") === name.toLocaleLowerCase("id")
  )) {
    showToast("Nama barang sudah terdaftar.");
    return;
  }
  if (!name || !Number.isSafeInteger(price) || price < 0 ||
      !Number.isSafeInteger(stock) || stock < 0 || !date) {
    showToast("Periksa kembali nama, harga, stok, dan tanggal.");
    return;
  }

  if (editingProductId) {
    const product = state.products.find(item => item.id === editingProductId);
    if (!product) {
      resetProductForm();
      showToast("Barang tidak ditemukan. Silakan pilih barang kembali.");
      return;
    }
    const previousProduct = { ...product };
    const previousMovementCount = state.movements.length;
    product.name = name;
    product.category = category;
    product.price = price;
    product.stock = stock;
    if (stock !== previousProduct.stock) {
      addMovement(product, stock > previousProduct.stock ? "masuk" : "keluar",
        Math.abs(stock - previousProduct.stock), price, date);
    }
    try {
      saveState();
    } catch (error) {
      Object.assign(product, previousProduct);
      state.movements.length = previousMovementCount;
      console.error("Gagal memperbarui barang:", error);
      showToast("Data tidak dapat disimpan. Periksa ruang penyimpanan browser.");
      return;
    }
    resetProductForm();
    render();
    showToast("Barang berhasil diperbarui.");
    return;
  }

  const product = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    category,
    price,
    stock
  };
  state.products.push(product);
  if (stock > 0) addMovement(product, "masuk", stock, price, date);
  try {
    saveState();
  } catch (error) {
    state.products.pop();
    if (stock > 0) state.movements.pop();
    console.error("Gagal menyimpan barang:", error);
    showToast("Data tidak dapat disimpan. Periksa ruang penyimpanan browser.");
    return;
  }
  resetProductForm();
  render();
  showToast("Barang berhasil ditambahkan.");
});

function resetProductForm() {
  editingProductId = null;
  productForm.reset();
  productForm.elements.date.value = localDate();
  productForm.elements.quantity.value = "0";
  productFormTitle.textContent = "Tambah barang";
  productStockLabel.textContent = "Stok awal";
  productSubmit.textContent = "Simpan barang";
  productCancel.hidden = true;
}

document.querySelector("#inventory-rows").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const product = state.products.find(item =>
    item.id === (button.dataset.addStock || button.dataset.editProduct || button.dataset.deleteProduct)
  );
  if (!product) return;

  if (button.dataset.addStock) {
    if (!Number.isSafeInteger(product.stock) || product.stock >= Number.MAX_SAFE_INTEGER) {
      showToast("Stok sudah mencapai batas maksimum.");
      return;
    }
    product.stock += 1;
    addMovement(product, "masuk", 1, product.price, localDate());
    try {
      saveState();
    } catch (error) {
      product.stock -= 1;
      state.movements.pop();
      console.error("Gagal menambah stok:", error);
      showToast("Stok tidak dapat disimpan. Periksa ruang penyimpanan browser.");
      return;
    }
    render();
    showToast("Stok barang berhasil ditambah 1.");
    return;
  }

  if (button.dataset.editProduct) {
    editingProductId = product.id;
    productForm.elements.name.value = product.name;
    productForm.elements.category.value = product.category;
    productForm.elements.price.value = String(product.price);
    productForm.elements.quantity.value = String(product.stock);
    productForm.elements.date.value = localDate();
    productFormTitle.textContent = "Edit barang";
    productStockLabel.textContent = "Stok saat ini";
    productSubmit.textContent = "Simpan perubahan";
    productCancel.hidden = false;
    productForm.elements.name.focus();
    return;
  }

  if (!window.confirm(`Hapus barang "${product.name}"? Riwayat transaksi tetap disimpan.`)) return;
  const productIndex = state.products.indexOf(product);
  state.products.splice(productIndex, 1);
  try {
    saveState();
  } catch (error) {
    state.products.splice(productIndex, 0, product);
    console.error("Gagal menghapus barang:", error);
    showToast("Barang tidak dapat dihapus. Periksa ruang penyimpanan browser.");
    return;
  }
  if (editingProductId === product.id) resetProductForm();
  render();
  showToast("Barang berhasil dihapus.");
});

productCancel.addEventListener("click", resetProductForm);

movementForm.addEventListener("submit", event => {
  event.preventDefault();
  const product = state.products.find(item => item.id === productSelect.value);
  const type = movementType.value;
  const quantity = Number(movementQuantity.value);
  const price = Number(movementPrice.value);
  const date = movementDate.value;

  if (!product) {
    showToast("Pilih barang terlebih dahulu.");
    return;
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !date) {
    showToast("Jumlah harus bilangan bulat positif dan tanggal wajib diisi.");
    return;
  }
  if (type === "keluar" && quantity > product.stock) {
    showToast(`Stok tidak cukup. Stok tersedia: ${product.stock}.`);
    return;
  }
  if (!Number.isSafeInteger(price) || price < 0) {
    showToast("Harga harus berupa angka nol atau lebih.");
    return;
  }

  const oldStock = product.stock;
  const oldPrice = product.price;
  product.stock += type === "masuk" ? quantity : -quantity;
  if (type === "masuk") product.price = price;
  addMovement(product, type, quantity, price, date);
  try {
    saveState();
  } catch (error) {
    product.stock = oldStock;
    product.price = oldPrice;
    state.movements.pop();
    console.error("Gagal menyimpan transaksi:", error);
    showToast("Transaksi tidak dapat disimpan. Periksa ruang penyimpanan browser.");
    return;
  }

  movementForm.elements.quantity.value = "";
  movementDate.value = localDate();
  render();
  showToast(`Barang ${type} berhasil dicatat.`);
});

productSelect.addEventListener("change", updateSelectedProduct);
movementType.addEventListener("change", updateSelectedProduct);
document.querySelector("#search").addEventListener("input", render);
movementSearch.addEventListener("input", render);
historyFilter.addEventListener("change", render);

productForm.elements.date.value = localDate();
movementDate.value = localDate();
render();
