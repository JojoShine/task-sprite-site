import { validateManifest, downloadFor } from './release-manifest.js';

for (const stage of document.querySelectorAll('.stage')) {
  const $ = selector => stage.querySelector(selector);
  const tasks = [
    { title: '补交项目周报', meta: '高优先级 · 已逾期1天', overdue: true, done: false },
    { title: '完成方案初稿', meta: '中优先级 · 今天下午', overdue: false, done: false },
    { title: '整理明天的工作清单', meta: '低优先级 · 明天上午', overdue: false, done: false },
  ];
  const names = { cat: '橘猫', shiba: '柴犬', robot: '机器人', ghost: '小幽灵' };
  let selected = 1;
  let current = 1;
  let feedbackTimer;
  let poseTimer;
  const pending = () => tasks.map((task, id) => ({ ...task, id })).filter(task => !task.done);
  const activeTask = () => pending().find(task => task.id === current) ?? pending()[selected];
  function feedback(text) {
    clearTimeout(feedbackTimer);
    $('[data-demo="demo-feedback"]').textContent = text;
    feedbackTimer = setTimeout(() => { $('[data-demo="demo-feedback"]').textContent = '点精灵换伙伴，点任务查看详情。'; }, 3500);
  }
  function pose(state) {
    clearTimeout(poseTimer);
    for (const sprite of stage.querySelectorAll('.sprite')) sprite.dataset.state = 'idle';
    const sprite = $(`[data-select-pet="${stage.dataset.pet}"] .sprite`);
    sprite.dataset.state = state;
    poseTimer = setTimeout(() => { sprite.dataset.state = 'idle'; }, 1400);
  }
  function closePanel(restoreFocus = true) {
    $('[data-demo="demo-panel"]').hidden = true;
    $('[data-demo="task-open"]').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('[data-demo="task-open"]').focus();
  }
  function completeTask(id) {
    tasks[id].done = true;
    const active = pending();
    current = active[0]?.id ?? null;
    selected = 0;
    render();
    pose('celebrate');
    feedback(active.length ? '完成一件，真好。' : '今天的任务都完成啦，休息一下。');
  }
  function render() {
    const active = pending();
    selected = Math.min(selected, Math.max(0, active.length - 1));
    const task = activeTask();
    $('[data-demo="todo-count"]').textContent = active.length;
    $('[data-demo="overdue-count"]').textContent = active.filter(item => item.overdue).length;
    $('[data-demo="demo-card-label"]').textContent = task ? current === task.id ? '正在做' : task.overdue ? '逾期提醒' : '接下来' : '今天的小进展';
    $('[data-demo="demo-card-title"]').textContent = task?.title ?? '都完成啦，休息一下。';
    $('[data-demo="demo-complete"]').disabled = !task;
    $('[data-demo="demo-complete"]').textContent = task ? '完成' : '已完成';
    $('[data-demo="demo-page"]').textContent = `${task ? active.findIndex(item => item.id === task.id) + 1 : 0} / ${active.length}`;
    $('[data-demo="demo-prev"]').disabled = $('[data-demo="demo-next"]').disabled = active.length < 2;
    $('[data-demo="demo-task-list"]').replaceChildren(...tasks.map((item, id) => {
      const row = document.createElement('div');
      row.className = `demo-task${item.overdue && !item.done ? ' overdue' : ''}${item.done ? ' completed' : ''}`;
      const complete = document.createElement('button');
      complete.setAttribute('aria-label', `${item.done ? '已完成' : '完成'} ${item.title}`);
      complete.disabled = item.done;
      if (item.done) complete.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#Check"/></svg>';
      complete.addEventListener('click', () => { completeTask(id); closePanel(); });
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.title;
      const meta = document.createElement('small');
      meta.textContent = item.done ? '已完成' : item.meta;
      content.append(title, meta);
      row.append(complete, content);
      if (!item.done) {
        const focus = document.createElement('button');
        focus.className = 'set-current';
        focus.textContent = current === id ? '当前任务' : '设为当前';
        focus.setAttribute('aria-label', `设为当前 ${item.title}`);
        focus.addEventListener('click', () => { current = id; selected = pending().findIndex(task => task.id === id); render(); closePanel(); feedback('已设为当前，做完直接点完成。'); });
        row.append(focus);
      }
      return row;
    }));
  }
  $('[data-demo="task-open"]').addEventListener('click', () => {
    $('[data-demo="demo-panel"]').hidden = false;
    $('[data-demo="task-open"]').setAttribute('aria-expanded', 'true');
    $('[data-demo="demo-close"]').focus();
  });
  $('[data-demo="demo-close"]').addEventListener('click', () => closePanel());
  $('[data-demo="demo-complete"]').addEventListener('click', () => { const task = activeTask(); if (task) completeTask(task.id); });
  for (const [id, direction] of [['[data-demo="demo-prev"]', -1], ['[data-demo="demo-next"]', 1]]) $(id).addEventListener('click', () => {
    const active = pending();
    selected = (active.findIndex(task => task.id === activeTask()?.id) + direction + active.length) % active.length;
    current = null;
    render();
  });
  $('[data-demo="demo-reset"]').addEventListener('click', () => {
    for (const task of tasks) task.done = false;
    selected = 1; current = 1;
    closePanel(false); render(); feedback('演示已重置。');
  });
  for (const choice of stage.querySelectorAll('[data-select-pet]')) choice.addEventListener('click', () => {
    const pet = choice.dataset.selectPet;
    if (stage.dataset.pet === pet) { pose('tap'); feedback(`${names[pet]}：摸摸头，收到啦。`); return; }
    stage.dataset.pet = pet;
    for (const button of stage.querySelectorAll('[data-select-pet]')) button.setAttribute('aria-pressed', String(button === choice));
    pose('tap'); feedback(`${names[pet]}来陪你完成下一件事。`);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('[data-demo="demo-panel"]').hidden) closePanel(); });
  document.addEventListener('click', event => { if (!$('[data-demo="demo-panel"]').hidden && !$('[data-demo="demo-panel"]').contains(event.target) && !$('[data-demo="task-open"]').contains(event.target)) closePanel(false); });
  render();
}

const sections = [...document.querySelectorAll('.page-section')];
const navLinks = [...document.querySelectorAll('.site-header nav a')];
function updateNavigation() {
  const active = sections.filter(section => section.getBoundingClientRect().top <= 150).at(-1) ?? sections[0];
  for (const link of navLinks) {
    if (link.hash === `#${active.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll', updateNavigation, { passive: true });
updateNavigation();


async function loadRelease() {
  const status = document.querySelector('[data-release-status]');
  try {
    const response = await fetch(new URL('releases/latest.json', document.baseURI), { cache: 'no-cache' });
    if (!response.ok) throw new Error('版本服务暂不可用');
    const release = validateManifest(await response.json());
    for (const card of document.querySelectorAll('[data-platform]')) {
      const asset = downloadFor(release, card.dataset.platform, card.dataset.arch);
      const button = card.querySelector('[data-download]');
      card.querySelector('.status-tag').textContent = asset ? `v${release.version}` : '暂未提供';
      if (!asset) { button.textContent = '暂未提供此平台'; continue; }
      button.href = asset.url;
      button.setAttribute('download', asset.filename);
      button.removeAttribute('aria-disabled');
      button.textContent = '下载安装包';
      card.querySelector('.os-content > p').textContent = `${asset.platform === 'macos' ? (asset.arch === 'aarch64' ? 'macOS 12+ · Apple Silicon' : 'macOS 12+ · Intel') : 'Windows 10 / 11 · 64 位'} · ${(asset.size / 1024 / 1024).toFixed(1)} MB`;
      const checksum = document.createElement('small');
      checksum.className = 'release-checksum';
      checksum.textContent = `SHA-256: ${asset.sha256}`;
      card.append(checksum);
    }
    status.textContent = `v${release.version} · 更新于 ${new Date(release.publishedAt).toLocaleDateString('zh-CN')} · ${release.notes}`;
  } catch {
    for (const card of document.querySelectorAll('[data-platform]')) {
      card.querySelector('.status-tag').textContent = '暂时不可用';
      card.querySelector('[data-download]').textContent = '稍后再试';
    }
    status.textContent = '暂时无法读取下载版本，请稍后刷新。';
  }
}
void loadRelease();

const adminContact = document.querySelector('#admin-contact');
const adminFeedback = document.querySelector('[data-admin-feedback]');
for (const button of document.querySelectorAll('[data-admin-open]')) {
  button.addEventListener('click', () => { adminFeedback.textContent = ''; adminContact.showModal(); });
}
document.querySelector('[data-admin-close]')?.addEventListener('click', () => adminContact.close());
document.querySelector('[data-admin-copy]')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('tbtparent'); adminFeedback.textContent = '微信号已复制，打开微信添加管理员即可。'; }
  catch { adminFeedback.textContent = '请手动复制微信号：tbtparent'; }
});

const miniappFeedback = document.querySelector('[data-miniapp-feedback]');
document.querySelector('[data-miniapp-copy]')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('案间'); miniappFeedback.textContent = '已复制「案间」，打开微信搜索小程序即可。'; }
  catch { miniappFeedback.textContent = '当前请在微信中搜索小程序：案间。'; }
});
