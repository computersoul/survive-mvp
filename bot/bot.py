import os
from pathlib import Path
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env')

API_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
FRONTEND_DOMAIN = os.getenv('VITE_FRONTEND_DOMAIN')

bot = Bot(token=API_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    inline_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Open",
            web_app=WebAppInfo(url=FRONTEND_DOMAIN)
        )]
    ])
    await message.answer("Click the button to open the game!", reply_markup=inline_kb)

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())