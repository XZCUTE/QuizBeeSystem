import { useNavigate } from "react-router-dom"
import Button from "@/components/Button"
import { useEffect } from "react"
import { useSocketContext } from "@/context/socket"
import toast from "react-hot-toast"

export default function Home() {
  const navigate = useNavigate()
  const { socket } = useSocketContext()

  useEffect(() => {
    socket.on("game:errorMessage", (message) => {
      toast.error(message)
    })

    return () => {
      socket.off("game:errorMessage")
    }
  }, [])

  const handleHostClick = () => {
    navigate("/host")
  }

  const handleParticipantClick = () => {
    navigate("/participant")
  }

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center">
      <div className="absolute h-full w-full overflow-hidden">
        <div className="absolute -left-[15vmin] -top-[15vmin] min-h-[75vmin] min-w-[75vmin] rounded-full bg-primary/15"></div>
        <div className="absolute -bottom-[15vmin] -right-[15vmin] min-h-[75vmin] min-w-[75vmin] rotate-45 bg-primary/15"></div>
      </div>

      <img src="https://i.imgur.com/7OSw7In.png" className="mb-6 h-32" alt="ICCT School Logo" />
      
      <div className="flex flex-col gap-4 w-full max-w-md px-4">
        <h1 className="text-center text-4xl font-bold text-primary mb-8">Quiz Bee System</h1>
        
        <Button 
          onClick={handleHostClick} 
          className="py-6 text-xl"
        >
          HOST
        </Button>
        
        <Button 
          onClick={handleParticipantClick} 
          className="py-6 text-xl"
        >
          PARTICIPANT
        </Button>
      </div>
    </section>
  )
}
