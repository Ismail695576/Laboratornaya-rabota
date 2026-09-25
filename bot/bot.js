const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// ==============================
// Подключение к Supabase
// ==============================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ==============================
// Запуск Telegram-бота
// ==============================

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {
  polling: true
});

console.log('Telegram-бот успешно запущен!');

// ==============================
// Команды /start и /groups
// ==============================

bot.onText(/\/start|\/groups/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Получаем список групп из Supabase
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name')
      .order('id', { ascending: true });

    if (error) {
      console.error('Ошибка Supabase:', error);

      await bot.sendMessage(
        chatId,
        'Ошибка при получении групп: ' + error.message
      );

      return;
    }

    if (!groups || groups.length === 0) {
      await bot.sendMessage(
        chatId,
        'В базе данных пока нет групп.'
      );

      return;
    }

    // Создаём кнопки групп
    const keyboard = groups.map(group => [
      {
        text: group.name,
        callback_data: `group_${group.id}`
      }
    ]);

    await bot.sendMessage(
      chatId,
      '📚 Выберите вашу группу:',
      {
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );

  } catch (err) {
    console.error('Ошибка /start:', err);

    await bot.sendMessage(
      chatId,
      'Произошла непредвиденная ошибка.'
    );
  }
});

// ==============================
// Нажатие на кнопку группы
// ==============================

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Убираем "часики" на кнопке после нажатия
  try {
    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error('Ошибка callback:', err);
  }

  if (!data || !data.startsWith('group_')) {
    return;
  }

  const groupId = data.replace('group_', '');

  try {
    // ==============================
    // Получаем расписание группы
    // ==============================

    const { data: schedule, error } = await supabase
      .from('schedule')
      .select('*')
      .eq('group_id', groupId)
      .order('day_of_week', { ascending: true })
      .order('lesson_number', { ascending: true });

    if (error) {
      console.error('Ошибка Supabase:', error);

      await bot.sendMessage(
        chatId,
        'Ошибка при получении расписания: ' + error.message
      );

      return;
    }

    if (!schedule || schedule.length === 0) {
      await bot.sendMessage(
        chatId,
        'Для этой группы пока нет расписания.'
      );

      return;
    }

    // ==============================
    // Разделяем расписание по дням
    // ==============================

    const days = {};

    schedule.forEach(row => {
      if (!days[row.day_of_week]) {
        days[row.day_of_week] = [];
      }

      days[row.day_of_week].push(row);
    });

    // ==============================
    // Названия дней недели
    // ==============================

    const dayNames = {
      1: 'Понедельник',
      2: 'Вторник',
      3: 'Среда',
      4: 'Четверг',
      5: 'Пятница',
      6: 'Суббота',
      7: 'Воскресенье'
    };

    // ==============================
    // Отправляем каждый день отдельно
    // ==============================

    for (const [day, lessons] of Object.entries(days)) {

      const dayName = dayNames[day] || `День ${day}`;

      let messageText = `📅 ${dayName}\n\n`;

      lessons.forEach(row => {

        messageText += `🔹 Пара №${row.lesson_number}\n`;

        messageText +=
          `📚 Предмет: ${row.subject_name || 'Не указан'}\n`;

        if (row.time_start && row.time_end) {
          // Убираем секунды: 08:30:00 → 08:30
          const startTime = row.time_start.slice(0, 5);
          const endTime = row.time_end.slice(0, 5);

          messageText +=
            `🕐 Время: ${startTime} — ${endTime}\n`;
        }

        messageText += '\n';
      });

      await bot.sendMessage(chatId, messageText);
    }

  } catch (err) {
    console.error('Ошибка при загрузке расписания:', err);

    await bot.sendMessage(
      chatId,
      'Ошибка при загрузке расписания.'
    );
  }
});

// ==============================
// Обработка ошибок polling
// ==============================

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});