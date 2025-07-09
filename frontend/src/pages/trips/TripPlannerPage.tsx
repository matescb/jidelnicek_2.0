import React from 'react'
import { useParams } from 'react-router-dom'

const TripPlannerPage: React.FC = () => {
  const { id } = useParams()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Trip Planner
      </h1>
      <p className="text-gray-600 dark:text-gray-400">Planning Trip ID: {id}</p>
    </div>
  )
}

export default TripPlannerPage