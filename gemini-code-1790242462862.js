// Конфигурация Supabase
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const groupSelect = document.getElementById('groupSelect');

// 1. Загрузка списка групп из Supabase
async function loadGroups() {
  try {
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name');

    if (error) throw error;

    groupSelect.innerHTML = '<option value="">-- Выберите группу --</option>';
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      groupSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Ошибка загрузки групп:', err);
    groupSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
  }
}

// 2. Добавление сообщения в интерфейс
function appendMessage(text, sender = 'bot') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  msgDiv.innerHTML = `
    <div class="bubble">${text}</div>
    <span class="time">${timeStr}</span>
  `;

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 3. Обработка команд (/today и /now)
async function handleCommand(cmd) {
  const selectedGroupId = groupSelect.value;

  if (!selectedGroupId) {
    appendMessage('⚠️ Пожалуйста, сначала выберите группу в шапке чата!');
    return;
  }

  const groupName = groupSelect.options[groupSelect.selectedIndex].text;
  const todayDayOfWeek = new Date().getDay() || 7; // 1 (Пн) - 7 (Вс)

  if (cmd === '/today') {
    const { data: schedule, error } = await supabase
      .from('schedule')
      .select('*')
      .eq('group_id', selectedGroupId)
      .eq('day_of_week', todayDayOfWeek)
      .order('lesson_number', { ascending: true });

    if (error || !schedule || schedule.length === 0) {
      appendMessage(`📅 Расписание для <b>${groupName}</b> на сегодня не найдено или пар нет.`);
      return;
    }

    let response = `📅 <b>Расписание на сегодня (${groupName}):</b>\n\n`;
    schedule.forEach(item => {
      response += `<b>${item.lesson_number} пара:</b> ${item.subject_name}\n🕒 ${item.time_start} - ${item.time_end}\n\n`;
    });
    appendMessage(response);

  } else if (cmd === '/now') {
    const nowTimeStr = new Date().toTimeString().split(' ')[0]; // "HH:MM:SS"

    const { data: schedule, error } = await supabase
      .from('schedule')
      .select('*')
      .eq('group_id', selectedGroupId)
      .eq('day_of_week', todayDayOfWeek)
      .lte('time_start', nowTimeStr)
      .gte('time_end', nowTimeStr);

    if (error || !schedule || schedule.length === 0) {
      appendMessage(`⚡ Сейчас у группы <b>${groupName}</b> нет пары.`);
      return;
    }

    const current = schedule[0];
    appendMessage(`⚡ <b>Текущая пара (${groupName}):</b>\n\n<b>${current.lesson_number} пара:</b> ${current.subject_name}\n🕒 ${current.time_start} - ${current.time_end}`);
  } else {
    appendMessage('❌ Неизвестная команда. Доступные команды: /today, /now');
  }
}

// Отправка команды из ввода или кнопок
function sendCommand(text) {
  const cmd = text || userInput.value.trim();
  if (!cmd) return;

  appendMessage(cmd, 'user');
  userInput.value = '';

  setTimeout(() => handleCommand(cmd), 300);
}

sendBtn.addEventListener('click', () => sendCommand());
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCommand();
});

// Инициализация при загрузке
loadGroups();