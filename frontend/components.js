function createTodoItem(t) {
  const li = document.createElement('li');
  if(t.done) li.className = 'done';

  const s = document.createElement('span');
  s.textContent = t.title;
  s.style.cursor = 'pointer';
  s.onclick = async () => { await api('/todos/'+t.id,{method:'PATCH'}); load(); };

  const b = document.createElement('button');
  b.textContent = '🗑';
  b.onclick = async () => { await api('/todos/'+t.id,{method:'DELETE'}); load(); };

  li.append(s,b);
  return li;
}
