// This is a sample component demonstrating how to fetch and list items (todos) from Supabase.
import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function Todos() {
  // Store the list of todos in component state
  const [todos, setTodos] = useState([])

  useEffect(() => {
    // Function to fetch all rows from the 'todos' table in the database
    async function getTodos() {
      const { data: todos } = await supabase.from('todos').select()

      // If records were found, update state to display them
      if (todos) {
        setTodos(todos)
      }
    }

    // Run the fetch once when this component loads
    getTodos()
  }, [])

  return (
    <ul>
      {/* Loop through each todo item and show its name */}
      {todos.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
