import asyncio
import logging
from datetime import datetime
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from supabase import create_client, Client

# Настрой свои данные от Supabase и Telegram Bot Token
TELEGRAM_TOKEN = "8845943428:AAEzxL-ITZyCd02fO9aMGlCMcE58uvM7vSw"
SUPABASE_URL = "https://dbodxldqvhtyjsdqppdh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRib2R4bGRxdmh0eWpzZHFwcGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMTg4MDEsImV4cCI6MjEwNTc5NDgwMX0.hXWWrb4Du2ec7j2yXnO7SrZWzwtmRCF4gBHpkK2_neY"

# Инициализация клиентов
bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

logging.basicConfig(level=logging.INFO)


# Получение списка групп из Supabase для клавиатуры
async def get_groups_keyboard():
    response = supabase.table("groups").select("id, name").execute()
    keyboard = []
    for group in response.data:
        keyboard.append([
            InlineKeyboardButton(
                text=group["name"],
                callback_data=f"group_{group['id']}"
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=keyboard)


# Команда /start или выбор группы
@dp.message(Command("start"))
async def cmd_start(message: Message):
    keyboard = await get_groups_keyboard()
    await message.answer("Привет! Выбери свою группу для просмотра расписания:", reply_markup=keyboard)


# Обработка выбора группы через инлайн-кнопки
@dp.callback_query(F.data.startswith("group_"))
async def process_group_selection(callback: CallbackQuery):
    group_id = callback.data.split("_")[1]
    # Сохраняем выбор пользователя (можно в памяти или сессии, для примера выведем подтверждение)
    await callback.message.answer(
        f"Группа выбрана! Теперь используй команды:\n/today — расписание на сегодня\n/now — текущая пара")
    await callback.answer()


# Команда /today (расписание на текущий день недели)
@dp.message(Command("today"))
async def cmd_today(message: Message):
    # Определяем день недели (1 — Пн, ... 6 — Сб)
    # datetime.weekday(): 0 - Пн, 5 - Сб, 6 - Вс
    today_num = datetime.now().weekday() + 1

    if today_num > 6:
        await message.answer("Сегодня воскресенье, пар нет! 🎉")
        return

    # Запрос расписания из Supabase (для примера берем группу с id=1, ПО-42)
    response = supabase.table("schedule") \
        .select("*") \
        .eq("group_id", 1) \
        .eq("day_of_week", today_num) \
        .order("lesson_number") \
        .execute()

    schedule = response.data
    if not schedule:
        await message.answer("На сегодня пар в базе не найдено.")
        return

    text = f"📖 **Расписание на сегодня (День недели: {today_num}):**\n\n"
    for item in schedule:
        text += f"*{item['lesson_number']} пара* ({item['time_start']} - {item['time_end']})\n"
        text += f"📚 {item['subject_name']}\n\n"

    await message.answer(text, parse_mode="Markdown")


# Команда /now (текущая пара)
@dp.message(Command("now"))
async def cmd_now(message: Message):
    now_time = datetime.now().strftime("%H:%M:%S")
    today_num = datetime.now().weekday() + 1

    # Ищем пару, которая идет прямо сейчас
    response = supabase.table("schedule") \
        .select("*") \
        .eq("group_id", 1) \
        .eq("day_of_week", today_num) \
        .lte("time_start", now_time) \
        .gte("time_end", now_time) \
        .execute()

    current_lesson = response.data
    if not current_lesson:
        await message.answer("Сейчас никакая пара не идет ☕")
        return

    item = current_lesson[0]
    text = f"⚡ **Сейчас идет пара:**\n\n" \
           f"*{item['lesson_number']} пара* ({item['time_start']} - {item['time_end']})\n" \
           f"📚 {item['subject_name']}"

    await message.answer(text, parse_mode="Markdown")


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())