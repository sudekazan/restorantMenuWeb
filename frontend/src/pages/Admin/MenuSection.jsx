import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { adminApi, staffApi } from '../../lib/api.js';
import CategoryList from './menu/CategoryList.jsx';
import ProductList from './menu/ProductList.jsx';
import CategoryFormModal from './menu/CategoryFormModal.jsx';
import ProductFormModal from './menu/ProductFormModal.jsx';
import { secondaryBtn } from './menu/menuUi.jsx';

const catIdOf = (product) => String(product.category?._id || product.category || '');
const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'tr');

/** Yönetim > Menü: kategori ve ürün yönetimi. */
export default function MenuSection() {
  const { restaurant } = useAuth();
  const currency = restaurant?.currency || 'TRY';
  const { toast } = useToast();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryForm, setCategoryForm] = useState(null); // { category?: object }
  const [productForm, setProductForm] = useState(null); // { product?: object }
  const [confirm, setConfirm] = useState(null); // { kind: 'category' | 'product', item }
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [reorderBusy, setReorderBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([adminApi.listCategories(), adminApi.listProducts()]);
      setCategories(cats);
      setProducts(prods);
      setError('');
    } catch (err) {
      setError(err.message || 'Menü yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Seçili kategori silinirse / ilk yüklemede ilk kategoriyi seç
  useEffect(() => {
    if (!categories.length) setSelectedId(null);
    else if (!categories.some((c) => c._id === selectedId)) setSelectedId(categories[0]._id);
  }, [categories, selectedId]);

  useEffect(() => setSearch(''), [selectedId]);

  const counts = useMemo(() => {
    const map = {};
    for (const p of products) map[catIdOf(p)] = (map[catIdOf(p)] || 0) + 1;
    return map;
  }, [products]);

  const selectedCategory = categories.find((c) => c._id === selectedId) || null;
  const categoryProducts = useMemo(
    () => products.filter((p) => catIdOf(p) === selectedId).sort(bySort),
    [products, selectedId]
  );

  /* ---------- Kategoriler ---------- */
  const saveCategory = async (payload) => {
    const editing = categoryForm?.category;
    try {
      if (editing) {
        const updated = await adminApi.updateCategory(editing._id, payload);
        setCategories((prev) => prev.map((c) => (c._id === editing._id ? { ...c, ...updated } : c)));
        toast({ title: 'Kategori güncellendi', variant: 'success', duration: 2500 });
      } else {
        const created = await adminApi.createCategory({ ...payload, sortOrder: categories.length });
        setCategories((prev) => [...prev, created]);
        setSelectedId(created._id);
        toast({ title: 'Kategori eklendi', variant: 'success', duration: 2500 });
      }
      setCategoryForm(null);
    } catch (err) {
      toast({ title: 'Kategori kaydedilemedi', description: err.message, variant: 'error' });
    }
  };

  const moveCategory = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const previous = categories;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next.map((c, i) => ({ ...c, sortOrder: i })));
    setReorderBusy(true);
    try {
      await adminApi.reorderCategories(next.map((c) => c._id));
    } catch (err) {
      setCategories(previous);
      toast({ title: 'Sıralama kaydedilemedi', description: err.message, variant: 'error' });
    } finally {
      setReorderBusy(false);
    }
  };

  const askDeleteCategory = (category) => {
    const count = counts[category._id] || 0;
    if (count > 0) {
      toast({
        title: 'Kategori silinemez',
        description: `Bu kategoride ${count} ürün var. Önce ürünleri başka kategoriye taşıyın veya silin.`,
        variant: 'error',
      });
      return;
    }
    setConfirm({ kind: 'category', item: category });
  };

  /* ---------- Ürünler ---------- */
  const saveProduct = async (payload, imageFile) => {
    const editing = productForm?.product;
    let saved;
    try {
      saved = editing ? await adminApi.updateProduct(editing._id, payload) : await adminApi.createProduct({ ...payload, sortOrder: counts[payload.category] || 0 });
    } catch (err) {
      toast({ title: 'Ürün kaydedilemedi', description: err.message, variant: 'error' });
      return;
    }

    let imageFailed = '';
    if (imageFile) {
      try {
        saved = await adminApi.uploadProductImage(saved._id, imageFile);
      } catch (err) {
        imageFailed = err.message || 'Görsel yüklenemedi.';
      }
    }

    setProducts((prev) => (editing ? prev.map((p) => (p._id === saved._id ? { ...p, ...saved } : p)) : [...prev, saved]));
    setProductForm(null);
    if (imageFailed) {
      toast({ title: 'Ürün kaydedildi ama görsel yüklenemedi', description: `${imageFailed} Ürünü düzenleyip tekrar deneyin.`, variant: 'error' });
    } else {
      toast({ title: editing ? 'Ürün güncellendi' : 'Ürün eklendi', variant: 'success', duration: 2500 });
    }
  };

  const toggleStock = async (product) => {
    const nextValue = !product.isAvailable;
    setPendingIds((prev) => new Set(prev).add(product._id));
    setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, isAvailable: nextValue } : p)));
    try {
      // Personel ucu: müşteri menüsüne ve mutfağa anlık bildirim gönderir
      await staffApi.setProductAvailability(product._id, nextValue);
    } catch (err) {
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, isAvailable: !nextValue } : p)));
      toast({ title: 'Stok durumu güncellenemedi', description: err.message, variant: 'error' });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(product._id);
        return next;
      });
    }
  };

  // Ürün sıralaması için ayrı bir uç yok: değişen ürünlerin sortOrder alanı tek tek güncellenir
  const moveProduct = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= categoryProducts.length) return;
    const ordered = [...categoryProducts];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const changes = ordered.map((p, i) => ({ id: p._id, from: p.sortOrder ?? 0, to: i })).filter((c) => c.from !== c.to);
    if (!changes.length) return;

    const previous = products;
    const orderMap = new Map(changes.map((c) => [c.id, c.to]));
    setProducts((prev) => prev.map((p) => (orderMap.has(p._id) ? { ...p, sortOrder: orderMap.get(p._id) } : p)));
    setReorderBusy(true);
    try {
      await Promise.all(changes.map((c) => adminApi.updateProduct(c.id, { sortOrder: c.to })));
    } catch (err) {
      setProducts(previous);
      toast({ title: 'Sıralama kaydedilemedi', description: err.message, variant: 'error' });
      load();
    } finally {
      setReorderBusy(false);
    }
  };

  /* ---------- Silme onayı ---------- */
  const confirmDelete = async () => {
    if (!confirm) return;
    const { kind, item } = confirm;
    try {
      if (kind === 'category') {
        await adminApi.deleteCategory(item._id);
        setCategories((prev) => prev.filter((c) => c._id !== item._id));
        toast({ title: `${item.name} silindi`, variant: 'success', duration: 2500 });
      } else {
        await adminApi.deleteProduct(item._id);
        setProducts((prev) => prev.filter((p) => p._id !== item._id));
        toast({ title: `${item.name} menüden kaldırıldı`, variant: 'success', duration: 2500 });
      }
      setConfirm(null);
    } catch (err) {
      toast({ title: 'Silinemedi', description: err.message, variant: 'error' });
    }
  };

  /* ---------- Görünüm ---------- */
  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-extrabold text-ink">Menü</h1>
        <div className="py-16 flex items-center justify-center gap-3 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          <span className="text-sm">Menü yükleniyor…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-extrabold text-ink">Menü</h1>
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <p className="text-sm text-rose-800">{error}</p>
          <button type="button" onClick={load} className={secondaryBtn}>
            Tekrar Dene
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">Menü</h1>
        <p className="text-sm text-ink-soft">Kategorileri ve ürünleri düzenleyin. Değişiklikler müşteri menüsüne yansır.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-4 items-start">
        <CategoryList
          categories={categories}
          counts={counts}
          selectedId={selectedId}
          busy={reorderBusy}
          onSelect={setSelectedId}
          onMove={moveCategory}
          onAdd={() => setCategoryForm({})}
          onEdit={(category) => setCategoryForm({ category })}
          onDelete={askDeleteCategory}
        />

        {selectedCategory ? (
          <ProductList
            category={selectedCategory}
            products={categoryProducts}
            currency={currency}
            search={search}
            onSearch={setSearch}
            pendingIds={pendingIds}
            reorderBusy={reorderBusy}
            onAdd={() => setProductForm({})}
            onEdit={(product) => setProductForm({ product })}
            onDelete={(product) => setConfirm({ kind: 'product', item: product })}
            onToggle={toggleStock}
            onMove={moveProduct}
          />
        ) : (
          <div className="bg-card border border-line rounded-3xl shadow-sm p-6 text-center">
            <p className="text-sm text-ink-soft">Ürünleri görmek için bir kategori ekleyin.</p>
          </div>
        )}
      </div>

      <CategoryFormModal
        open={!!categoryForm}
        category={categoryForm?.category}
        onClose={() => setCategoryForm(null)}
        onSubmit={saveCategory}
      />
      <ProductFormModal
        open={!!productForm}
        product={productForm?.product}
        categories={categories}
        defaultCategoryId={selectedId}
        onClose={() => setProductForm(null)}
        onSubmit={saveProduct}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'category' ? 'Kategoriyi sil' : 'Ürünü sil'}
        description={
          confirm?.kind === 'category'
            ? `"${confirm?.item.name}" kategorisi kalıcı olarak silinecek. Bu işlem geri alınamaz.`
            : `"${confirm?.item.name}" menüden kaldırılacak. Geçmiş siparişler ve raporlar etkilenmez.`
        }
        confirmLabel={confirm?.kind === 'category' ? 'Kategoriyi Sil' : 'Ürünü Sil'}
        onConfirm={confirmDelete}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}
