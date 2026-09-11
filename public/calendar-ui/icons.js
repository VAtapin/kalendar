const $ = id => document.getElementById(id);
const API = "https://bible-desktop.com/api/calendar/icons";
const state = { page: 1, size: 12, total: 0, imageTotal: 0, cards: [] };
const kindLabel = kind => ({ "mother-of-god": "Иконы Богородицы", savior: "Иконы Спасителя", saint: "Иконы святых", other: "Другие иконы" }[kind] || kind);
function requestParams() {
    const params = new URLSearchParams({ page: String(state.page), per_page: String(state.size), with_images: "1" });
    const query = $("search").value.trim();
    const kind = $("kind").value;
    const day = $("day").value;
    if ($("saint").value)
        params.set("saint", $("saint").value);
    if (query)
        params.set("query", query);
    if (kind)
        params.set("kind", kind);
    if (day && $("day").validity.valid)
        params.set("month_day", day.slice(5));
    return params;
}
function showLightbox(card, initial = "image") {
    const images = card.images || [];
    if (!images.length && !card.description)
        return;
    const dialog = $("lightbox"), large = $("large"), thumbs = $("thumbs");
    const history = $("lightbox-history"), historyText = $("lightbox-history-text");
    const previous = dialog.querySelector(".previous"), next = dialog.querySelector(".next");
    const hasHistory = Boolean(card.description);
    const screenCount = images.length + (hasHistory ? 1 : 0);
    let index = initial === "history" && hasHistory ? 0 : (hasHistory ? 1 : 0);
    const showScreen = requested => {
        index = (requested + screenCount) % screenCount;
        const historyScreen = hasHistory && index === 0;
        dialog.classList.toggle("showing-history", historyScreen);
        history.hidden = !historyScreen;
        large.hidden = historyScreen;
        if (!historyScreen) {
            const image = images[index - (hasHistory ? 1 : 0)];
            large.src = image.url;
            large.alt = card.title;
        }
        [...thumbs.children].forEach((node, position) => node.classList.toggle("active", position === index));
    };
    historyText.textContent = card.description || "";
    const items = [];
    if (hasHistory) {
        const historyThumb = document.createElement("button");
        historyThumb.type = "button";
        historyThumb.className = "history-thumb";
        historyThumb.textContent = "История";
        historyThumb.onclick = () => showScreen(0);
        items.push(historyThumb);
    }
    items.push(...images.map((image, position) => {
        const thumb = new Image();
        thumb.src = image.url;
        thumb.alt = card.title;
        thumb.onclick = () => showScreen(position + (hasHistory ? 1 : 0));
        return thumb;
    }));
    thumbs.replaceChildren(...items);
    const navigate = offset => showScreen(index + offset);
    previous.disabled = next.disabled = screenCount < 2;
    previous.onclick = () => navigate(-1);
    next.onclick = () => navigate(1);
    dialog.navigateImage = screenCount < 2 ? undefined : navigate;
    showScreen(index);
    dialog.showModal();
}
function installLightboxNavigation() {
    const dialog = $("lightbox"), large = $("large");
    let touchStartX = null;
    document.addEventListener("keydown", event => {
        if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey)
            return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            dialog.navigateImage?.(-1);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            dialog.navigateImage?.(1);
        }
    });
    large.addEventListener("touchstart", event => {
        if (event.touches.length === 1)
            touchStartX = event.touches[0].clientX;
    }, { passive: true });
    large.addEventListener("touchend", event => {
        if (touchStartX === null || event.changedTouches.length !== 1)
            return;
        const distance = event.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(distance) < 48)
            return;
        dialog.navigateImage?.(distance < 0 ? 1 : -1);
    }, { passive: true });
    dialog.addEventListener("close", () => { touchStartX = null; });
}
function render() {
    const gallery = $("gallery");
    gallery.replaceChildren(...state.cards.map(card => {
        const article = document.createElement("article");
        article.className = "card";
        const body = document.createElement("div");
        body.className = "card-body";
        const images = card.images || [];
        if (images.length) {
            const picture = document.createElement("button"), image = new Image();
            picture.className = "picture";
            image.src = images[0].url;
            image.alt = card.title;
            image.loading = "lazy";
            picture.append(image);
            picture.onclick = () => showLightbox(card);
            article.append(picture);
        }
        const title = document.createElement("h2"), titleLink = document.createElement("a");
        titleLink.href = "/icon.html?id=" + encodeURIComponent(card.id);
        titleLink.textContent = card.title;
        titleLink.setAttribute("aria-label", "Открыть страницу иконы: " + card.title);
        title.append(titleLink);
        const dates = document.createElement("p");
        dates.className = "meta";
        const celebrations = card.dates || [];
        dates.textContent = celebrations.length ? "Празднование: " + celebrations.map(item => item.label || item.monthDay).join(", ") : "Дата празднования не указана";
        const chips = document.createElement("div"), chip = document.createElement("span");
        chips.className = "chips";
        chip.className = "chip";
        chip.textContent = kindLabel(card.kind);
        chips.append(chip);
        body.append(title, dates, chips);
        if (card.description) {
            const history = document.createElement("button"), copy = document.createElement("button");
            history.className = "history";
            history.type = "button";
            history.textContent = "История образа";
            history.onclick = () => showLightbox(card, "history");
            copy.className = "copy-link";
            copy.type = "button";
            copy.title = "Скопировать ссылку на икону";
            copy.setAttribute("aria-label", copy.title);
            copy.textContent = "↗";
            copy.onclick = async () => { await navigator.clipboard.writeText(new URL("/icon.html?id=" + encodeURIComponent(card.id), location.origin).href); copy.textContent = "✓"; };
            const actions = document.createElement("div");
            actions.className = "card-actions";
            actions.append(history, copy);
            body.append(actions);
        }
        article.append(body);
        return article;
    }));
    const maxPage = Math.max(1, Math.ceil(state.total / state.size));
    $("status").textContent = `Найдено: ${state.total} образа · ${state.imageTotal} изображений · страница ${state.page} из ${maxPage}`;
    const visiblePages = [...new Set([1, 2, 3, state.page - 2, state.page - 1, state.page, state.page + 1, state.page + 2, maxPage - 2, maxPage - 1, maxPage]
            .filter(page => page >= 1 && page <= maxPage))].sort((left, right) => left - right);
    const pageButtons = () => {
        const button = (label, page, disabled = false, current = false) => {
            const node = document.createElement("button");
            node.type = "button";
            node.textContent = label;
            node.disabled = disabled;
            if (current)
                node.setAttribute("aria-current", "page");
            if (!disabled)
                node.onclick = () => { state.page = page; load(); };
            return node;
        };
        const nodes = [button("← Назад", state.page - 1, state.page === 1)];
        let previousPage = 0;
        for (const page of visiblePages) {
            if (page - previousPage > 1) {
                const gap = document.createElement("span");
                gap.textContent = "…";
                gap.setAttribute("aria-hidden", "true");
                nodes.push(gap);
            }
            nodes.push(button(String(page), page, page === state.page, page === state.page));
            previousPage = page;
        }
        nodes.push(button("Вперёд →", state.page + 1, state.page === maxPage));
        return nodes;
    };
    document.querySelectorAll(".pages").forEach(pages => pages.replaceChildren(...pageButtons()));
}
async function load() {
    $("status").textContent = "Загрузка из Bible Desktop…";
    try {
        const response = await fetch(`${API}?${requestParams()}`, { headers: { Accept: "application/json" } });
        if (!response.ok)
            throw new Error(String(response.status));
        const data = await response.json();
        state.cards = Array.isArray(data.data) ? data.data : [];
        state.total = Number(data.total || 0);
        state.imageTotal = Number(data.imageTotal || state.cards.reduce((total, card) => total + (card.images || []).length, 0));
        render();
    }
    catch (error) {
        $("status").textContent = "Не удалось загрузить библиотеку: " + error.message;
    }
}
for (const id of ["search", "kind", "day", "saint"])
    $(id).addEventListener(id === "search" ? "input" : "change", () => {
        if (id === "kind")
            $("saint").value = "";
        if (id === "day" && !$("day").validity.valid)
            return;
        state.page = 1;
        load();
    });
$("page-size").addEventListener("change", () => { state.size = Number($("page-size").value); state.page = 1; load(); });
$("lightbox").querySelector(".close").onclick = () => $("lightbox").close();
installLightboxNavigation();
if (/^\/icons-of-mother-of-god(?:\.html)?\/?$/.test(location.pathname)) {
    $('kind').value = 'mother-of-god';
    document.querySelector('h1').textContent = 'Иконы Богородицы';
}
load();
