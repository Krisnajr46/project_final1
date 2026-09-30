const l = document.getElementById('l');
const api = (p,o)=>fetch('/api'+p,{
  headers:{
    'Content-Type':'application/json',
    'Authorization':'Bearer ' + localStorage.getItem('token') // tambahkan ini
  },
  ...o
});

async function load(){
  const r = await (await api('/todos')).json();
  l.replaceChildren(...r.map(t => createTodoItem(t)));
}

document.getElementById('f').onsubmit = async e => {
  e.preventDefault();
  const i = document.getElementById('t');
  await api('/todos',{method:'POST',body:JSON.stringify({title:i.value})});
  i.value = '';
  load();
};

load();
