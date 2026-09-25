const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// ==========================================
// ПОДКЛЮЧЕНИЕ К SUPABASE
// ==========================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ==========================================
// ЗАПУСК TELEGRAM-БОТА
// ==========================================

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {
  polling: true
});

console.log('Telegram-бот успешно запущен!');

// ==========================================
// НАЗВАНИЯ ДНЕЙ НЕДЕЛИ
// ==========================================

const dayNames = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье'
};

// ==========================================
// ПОЛУЧЕНИЕ ТЕКУЩЕГО ДНЯ
// Казахстан — UTC+5
// ==========================================

function getTodayNumber() {
  const dayName = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'Asia/Almaty'
  }).format(new Date());

  const days = {
    'понедельник': 1,
    'вторник': 2,
    'среда': 3,
    'четверг': 4,
    'пятница': 5,
    'суббота': 6,
    'воскресенье': 7
  };

  return days[dayName.toLowerCase()];
}

// ==========================================
// /start И /groups
// ==========================================

bot.onText(/\/start|\/groups/, async (msg) => {

  const chatId = msg.chat.id;

  try {

    // Получаем группы из Supabase
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name')
      .order('id', { ascending: true });

    if (error) {

      console.error('Ошибка получения групп:', error);

      await bot.sendMessage(
        chatId,
        '❌ Ошибка при получении групп.'
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

    // Создаём кнопки
    const keyboard = groups.map(group => [
      {
        text: group.name,
        callback_data: `group_${group.id}`
      }
    ]);

    await bot.sendMessage(
      chatId,
      '🎓 Выберите вашу группу:',
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
      '❌ Произошла непредвиденная ошибка.'
    );
  }
});

// ==========================================
// ВЫБОР ГРУППЫ
// ==========================================

bot.on('callback_query', async (query) => {

  const chatId = query.message.chat.id;
  const data = query.data;

  // Убираем загрузку с нажатой кнопки
  try {
    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error('Callback error:', err);
  }

  if (!data || !data.startsWith('group_')) {
    return;
  }

  // Получаем ID выбранной группы
  const groupId = data.replace('group_', '');

  try {

    // ==========================================
    // ОПРЕДЕЛЯЕМ СЕГОДНЯШНИЙ ДЕНЬ
    // ==========================================

    const today = getTodayNumber();

    const todayName = dayNames[today];

    console.log(
      `Запрошено расписание: группа ${groupId}, день ${today}`
    );

    // ==========================================
    // ВОСКРЕСЕНЬЕ
    // ==========================================

    if (today === 7) {

      await bot.sendMessage(
        chatId,
        '📅 Сегодня воскресенье.\n\n🎉 Занятий нет!'
      );

      return;
    }

    // ==========================================
    // ЗАПРОС В SUPABASE
    // Только выбранная группа + сегодняшний день
    // ==========================================

    const { data: schedule, error } = await supabase
      .from('schedule')
      .select('*')
      .eq('group_id', groupId)
      .eq('day_of_week', today)
      .order('lesson_number', { ascending: true });

    if (error) {

      console.error(
        'Ошибка получения расписания:',
        error
      );

      await bot.sendMessage(
        chatId,
        '❌ Ошибка при получении расписания.'
      );

      return;
    }

    // ==========================================
    // ЕСЛИ ПАР НЕТ
    // ==========================================

    if (!schedule || schedule.length === 0) {

      await bot.sendMessage(
        chatId,
        `📅 Сегодня: ${todayName}\n\n🎉 На сегодня занятий нет!`
      );

      return;
    }

    // ==========================================
    // ФОРМИРУЕМ СООБЩЕНИЕ
    // ==========================================

    let messageText =
      `📅 Расписание на сегодня\n` +
      `📆 ${todayName}\n\n`;

    schedule.forEach(row => {

      messageText +=
        `🔹 Пара №${row.lesson_number}\n`;

      messageText +=
        `📚 Предмет: ${row.subject_name || 'Не указан'}\n`;

      // Время пары
      if (row.time_start && row.time_end) {

        const startTime =
          String(row.time_start).slice(0, 5);

        const endTime =
          String(row.time_end).slice(0, 5);

        messageText +=
          `🕐 Время: ${startTime} — ${endTime}\n`;
      }

      messageText += '\n';
    });

    // ==========================================
    // ОТПРАВЛЯЕМ РАСПИСАНИЕ
    // ==========================================

    await bot.sendMessage(
      chatId,
      messageText
    );

  } catch (err) {

    console.error(
      'Ошибка при загрузке расписания:',
      err
    );

    await bot.sendMessage(
      chatId,
      '❌ Ошибка при загрузке расписания.'
    );
  }
});

// ==========================================
// ОШИБКИ POLLING
// ==========================================

bot.on('polling_error', (error) => {
  console.error(
    'Polling error:',
    error.message
  );
});