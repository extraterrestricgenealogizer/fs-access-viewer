reveal_access();


function s_parse_permissions(r) {
    const raw_permissions = r.split(":");
    const permissions = [];
    
    for (const p of raw_permissions) {
        if      (p === "ThemisPrmAnyone")              { permissions.push("Unrestricted"); }
        else if (p === "ThemisPrmAffiliate")           { permissions.push("Affiliate"); }
        else if (p === "ThemisPrmFhlc")                { permissions.push("FHC"); }
        else if (p === "ThemisPrmNoAccess")            { permissions.push("No Access"); }
        else if (p === "ThemisPrmLdsMember")           { permissions.push("LDS"); }
        else if (p === "ThemisPrmAutoIndexRestricted") { permissions.push("No Auto-Indexing"); }
        else if (p === "ThemisPrmRegisteredPatron")    { permissions.push("Registered Patron"); }
        else if (p === "ThemisPrmSensitive")           { permissions.push("Sensitive"); }
        else if (p === "ThemisPrmAncestry")            { permissions.push("Ancestry"); }
        else if (p === "ThemisPrmFindMyPast")          { permissions.push("FindMyPast"); }
        else if (p === "ThemisPrmMyHeritage")          { permissions.push("MyHeritage"); }
        else if (p === "ThemisPrmFhlSLC")              { permissions.push("FHL SLC"); }
        else if (p === "ThemisPrmNotSignedIn")         { permissions.push("No Sign-In Required"); }
        else if (p === "CdsPrmAnyone")                 { permissions.push("Unrestricted (CDS)"); }
        else if (p === "CdsPrmNoAccess")               { permissions.push("No Access (CDS)"); }
        else                                           { permissions.push(p); }
    }
    
    return permissions;
}


/* ================= RECORD ================= */

function wait_for_element(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}


async function r_fetch_gedcomx(ark_id) {    
    const url = "https://www.familysearch.org/ark:/61903/" + ark_id;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/x-gedcomx-v1+json"
        }
    });
    const result = await response.json();
    if (response.ok)
        return result;
    else
        return "";
}


async function r_fetch_dgsno_from_film(f) {
    const padded_film_no = String(f).padStart(9, "0");
    const response = await fetch("https://www.familysearch.org/service/search/cat/gsNumber/" + padded_film_no);
    const result = await response.text();

    if (response.ok)
        return result;
    else
        return "";
}


async function r_parse_json_info(r) {
    let film_no = "";
    let dgs_no = "";
    
    for (const f of r.fields) {
        if (f.type === "http://familysearch.org/types/fields/DigitalFilmNumber") {
            dgs_no = f.values[0].text;
        }
        else if (f.type === "http://familysearch.org/types/fields/FilmNumber") {
            film_no = f.values[0].text;
        }
    }
    
    return {dgs: dgs_no, film: film_no};
}


async function r_fetch_permissions(dgs_no) {
    const padded_dgs_no = String(dgs_no).padStart(9, "0");
    const response = await fetch("https://sg30p0.familysearch.org/service/records/storage/dascloud/das/v2/dgs:" + padded_dgs_no + "/permission");
    const result = response.text();
    
    if (response.ok)
        return result;
    else
        return "";
}


function r_display_permissions(permissions) {
    const perm_str = permissions.join(", ");
    wait_for_element("h5 div")
        .then( e => {
            let start = e.parentElement.parentElement;
            while (start.nextElementSibling !== null) {
                start = start.nextElementSibling;
            }
            
            const d = start.lastElementChild.lastElementChild;
            
            const extra_div = d.cloneNode();
            extra_div.innerText = "(" + perm_str + ")";

            if (d.nextElementSibling === null) {
                d.parentElement.insertBefore(extra_div, d.nextElementSibling);
            }
        });
}


async function record_page() {
    const ark_id = window.location.href.split("/")[5].split("?")[0];
    const response = await r_fetch_gedcomx(ark_id);
    if (response === "") {
        return;
    }
    
    const info = await r_parse_json_info(response);
    if (info.dgs === "" && info.film !== "")
        info.dgs = await r_fetch_dgsno_from_film(info.film);
    else if (info.dgs === "" && info.film === "")
        return;
        
    const perm_str = await r_fetch_permissions(info.dgs);
    if (perm_str !== "") {
        const permissions = s_parse_permissions(perm_str);
        r_display_permissions(permissions);
    }
}



/* ================= CATALOG ================= */

function c_get_header_row() {
    return document.querySelector("th.filmNoteHeader").parentElement;
}


function c_center_header_row(header_row) {
    header_row.lastElementChild.setAttribute("style", "text-align:center");
}


function c_get_films_tbody(header_row) {
    return header_row.parentElement.parentElement.lastElementChild;
}


function c_clear_added_rows() {
    [...document.getElementsByClassName("fs-access-viewer-added")].map(n => n && n.remove());
}


function c_element_children_array(e) {
    return Array.from(e.children);
}


function c_get_row_film_no(row) {
    return Number(row.children.item(3).firstElementChild.firstElementChild.innerHTML);
}


function c_get_row_dgs_no(row) {
    return Number(row.children.item(4).firstElementChild.firstElementChild.innerHTML);
}


function c_get_row_permissions_catalog_fallback(film_no, dgs_no) {
    // Fallback to using 'data' JS object defined in page scripts.
    // Make approximate deep copy and use that instead of live object.
    // Check that it's valid.
    const data_copy = structuredClone(window.wrappedJSObject.data);
    if (!Array.isArray(data_copy.film_note)) {
        return;
    }


    for (const i of data_copy.film_note) {
        if (i.filmno == film_no || i.digital_film_no == dgs_no) {
            if (typeof i.digital_film_rights === "string") {
                const permissions = []
                permissions.push(i.digital_film_rights);
                return permissions;
            }
            else if (Array.isArray(i.digital_film_rights)) {
                return i.digital_film_rights;
            }
            else {
                return;
            }
        }
    }
}


function c_create_permissions_url(row) {
    const dgs_no = c_get_row_dgs_no(row);
    const padded_dgs_no = String(dgs_no).padStart(9, "0");
    return "https://sg30p0.familysearch.org/service/records/storage/dascloud/das/v2/dgs:" + padded_dgs_no + "/permission";
}


function c_get_row_permissions(result, row) {

    if (result.stat) {
        return s_parse_permissions(result.txt);
    }
    else {
        const dgs_no = c_get_row_dgs_no(row);
        const film_no = c_get_row_film_no(row);   
        return c_get_row_permissions_catalog_fallback(film_no, dgs_no);
    }
}


function c_create_permissions_row(row, permissions) {
    const fragment = document.createDocumentFragment();

    const extra_row = document.createElement("tr");
    extra_row.setAttribute("class", "film-item ng-scope fs-access-viewer-added");
    extra_row.setAttribute("data-ng-repeat", "copy in paged_filtered_film_copies");
    
    const td1 = document.createElement("td");
    td1.setAttribute("class", "note-header");
    fragment.appendChild(td1);
    
    for (let i = 0; i < 4; i++) {
        const td = document.createElement("td");
        fragment.appendChild(td);
    }
    
    const td2 = document.createElement("td");
    td2.setAttribute("style", "text-align:center");
    td2.innerText = permissions.join(", ");
    fragment.appendChild(td2);
    
    
    extra_row.appendChild(fragment);

    if (row.nextElementSibling === null || !row.nextElementSibling.classList.contains("fs-access-viewer-added")) {
        row.parentElement.insertBefore(extra_row, row.nextElementSibling);
    }
}


function c_parse_results_and_display_permissions(results, rows) {
    results.forEach( (result, index) => {
        const permissions = c_get_row_permissions(result, rows[index]);
        c_create_permissions_row(rows[index], permissions);
    });
}


function catalog_page() {
    const header_row = c_get_header_row();
    c_center_header_row(header_row);
    const films_tbody = c_get_films_tbody(header_row);
    if (!films_tbody.children) {
        return;
    }


    const config = { attributes: true, childList: true, subtree: true };
    const callback = (mutations, observer) => {
        for (const m of mutations) {
            if (m.removedNodes) {
                for (const r of m.removedNodes) {
                    if (r.id === "observer_target") {
                        observer.disconnect();

                        c_clear_added_rows();
                        films_tbody.children[0].setAttribute("id", "observer_target");

                        const row_arr = c_element_children_array(films_tbody);
                        const urls = row_arr.map(row => {
                            return c_create_permissions_url(row);
                        });

                        Promise.all( urls.map( u => fetch(u) ) )
                            .then(responses => Promise.all( responses.map( rsp => rsp.text().then( t => ({stat: rsp.ok, txt: t}) ) ) ) )
                            .then(results => c_parse_results_and_display_permissions(results, row_arr));

                        observer.observe(films_tbody, config);
                        break;
                    }
                }
            }
        }
    };

    const dummy_row = document.createElement("tr");
    dummy_row.setAttribute("id", "observer_target");
    films_tbody.insertBefore(dummy_row, films_tbody.lastElementChild.nextElementSibling);
    
    const observer = new MutationObserver(callback);
    observer.observe(films_tbody, config);
    
    document.getElementById("observer_target").remove();
}



/* ================= GENERAL ================= */

function url_matches_pattern(pattern) {
    const match = window.location.href.match(pattern);
    return match !== null;
}


function reveal_access() {
    const catalog_pattern = "^https:\\/\\/www\\.familysearch\\.org\\/search\\/catalog\\/\\d+(?:\\?.*){0,1}$";
    const record_pattern  = "^https:\\/\\/www\\.familysearch\\.org\\/ark:\\/61903\\/1:1:.{4}\\-.{3,4}(?:\\?.*){0,1}$";


    if (url_matches_pattern(catalog_pattern)) {
        catalog_page();
        return;
    }

    if (url_matches_pattern(record_pattern)) {
        window.addEventListener("load", record_page);
        return;
    }
}
