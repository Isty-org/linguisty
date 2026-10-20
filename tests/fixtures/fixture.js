/* @spec spec://modules/page/FEAT-002-page-translation#acceptance */
(() => {
  let insertions = 0;
  let submissions = 0;
  const region = document.getElementById('dynamic-region');
  const form = document.getElementById('contact');
  const next = document.getElementById('gallery-next');
  const originalReferences = { form, next, name: document.getElementById('contact-name'), note: document.getElementById('contact-note') };
  function addListing() {
    if (!region || insertions >= 50) return;
    insertions++;
    const paragraph = document.createElement('p');
    paragraph.id = `dynamic-${insertions}`;
    paragraph.textContent = `Nouvelle annonce : maison avec jardin ${insertions}.`;
    region.append(paragraph);
  }
  function removeListing() { region?.lastElementChild?.remove(); }
  function changeRoute() {
    history.pushState({}, '', '?quartier=2');
    document.title = 'Maisons à Nantes — fixture Linguisty';
    const heading = document.querySelector('h1');
    if (heading) heading.textContent = 'Maisons disponibles à Nantes';
    region?.replaceChildren();
    addListing();
  }
  next?.addEventListener('click', () => {
    const gallery = document.getElementById('gallery');
    const photo = Number(gallery.dataset.photo) % 3 + 1;
    gallery.dataset.photo = String(photo);
    document.getElementById('gallery-count').textContent = `${photo} / 3`;
  });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    submissions++;
    document.getElementById('form-result').textContent = `submitted:${submissions}`;
  });
  document.getElementById('add-listing')?.addEventListener('click', addListing);
  document.getElementById('remove-listing')?.addEventListener('click', removeListing);
  document.getElementById('change-route')?.addEventListener('click', changeRoute);
  window.linguistyFixture = {
    addListing, removeListing, changeRoute,
    inspect() {
      return { insertions, submissions, referencesPreserved: Object.entries(originalReferences).every(([key, element]) => !element || element === document.getElementById(({ form: 'contact', next: 'gallery-next', name: 'contact-name', note: 'contact-note' })[key])), dynamicNodes: region?.childElementCount ?? 0 };
    },
  };
})();
