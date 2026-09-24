const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_ANON_KEY
);

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const update = req.body;
      
      // 1. Команда /start или /groups — показываем группы из таблицы groups
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;

        if (text === '/groups' || text === '/start') {
          const { data: groups, error } = await supabase
            .from('groups')
            .select('id, name'); // Забираем id и name из таблицы groups

          if (error) {
            await bot.sendMessage(chatId, "Ошибка при получении групп: " + error.message);
          } else if (!groups || groups.length === 0) {
            await bot.sendMessage(chatId, "В базе данных пока нет групп.");
          } else {
            // Создаем кнопки с ID группы в callback_data
            const keyboard = groups.map(group => [{
              text: group.name,
              callback_data: `group_${group.id}`
            }]);

            await bot.sendMessage(chatId, "Выберите вашу группу из базы данных:", {
              reply_markup: { inline_keyboard: keyboard }
            });
          }
        }
      }

      // 2. Обработка нажатия на кнопку группы
      if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data; // например, "group_1"

        if (data.startsWith('group_')) {
          const groupId = data.replace('group_', '');
          
          // Запрос расписания из таблицы schedule по Foreign Key (group_id)
          const { data: schedule, error } = await supabase
            .from('schedule')
            .select('*')
            .eq('group_id', groupId);

          if (error || !schedule || schedule.length === 0) {
            await bot.sendMessage(chatId, "Для этой группы пока нет расписания.");
          } else {
            let messageText = `📅 Расписание:\n\n`;
            schedule.forEach(row => {
              messageText += `🔹 День: ${row.day_of_week} (Пара №${row.lesson_number})\n`;
              messageText += `📚 Предмет: ${row.subject}\n`;
              messageText += `👨🏫 Преподаватель: ${row.teacher}\n`;
              messageText += `🚪 Аудитория: ${row.classroom}\n\n`;
            });

            await bot.sendMessage(chatId, messageText);
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
