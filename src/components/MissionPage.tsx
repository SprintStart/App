import { Heart, Lightbulb, Shield, Zap } from 'lucide-react';

export function MissionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">Our Mission</h1>
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto">
            Empower every teacher to create exceptional learning experiences
            through intelligent, accessible assessment tools.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Why We Exist</h2>
          <p className="text-lg text-gray-700 mb-4">
            Teachers spend countless hours creating assessments when they should be focusing on
            what matters most: teaching and connecting with students. We believe this time can
            be reclaimed through intelligent automation that doesn't sacrifice quality.
          </p>
          <p className="text-lg text-gray-700">
            StartSprint exists to eliminate the busywork and amplify the impact of every educator,
            giving them superpowers to create, deliver, and analyze assessments at scale.
          </p>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Our Core Values</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Teachers First</h3>
            </div>
            <p className="text-gray-700">
              Every decision we make starts with one question: Does this help teachers?
              We prioritize educator needs above all else, building tools that solve real
              classroom challenges.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Lightbulb className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Simplicity</h3>
            </div>
            <p className="text-gray-700">
              Complex doesn't mean better. We believe in elegant, intuitive design that anyone
              can use effectively from day one. No steep learning curves, no unnecessary features.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Privacy & Safety</h3>
            </div>
            <p className="text-gray-700">
              Student privacy is non-negotiable. We've built StartSprint to require zero personal
              information from students, ensuring complete anonymity and GDPR compliance.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Zap className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Innovation</h3>
            </div>
            <p className="text-gray-700">
              We harness cutting-edge AI and technology to push the boundaries of what's possible
              in educational assessment, while keeping the experience human-centered.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-white mb-12">
          <h2 className="text-3xl font-bold mb-4">Our Vision for Education</h2>
          <p className="text-lg mb-4">
            We envision a world where every teacher has access to professional-grade assessment
            tools, regardless of budget or technical expertise. Where creating a high-quality
            quiz takes minutes, not hours. Where data-driven insights are instant, not buried
            in spreadsheets.
          </p>
          <p className="text-lg">
            This isn't about replacing teachers—it's about empowering them to do what only humans
            can do: inspire, guide, and transform lives through education.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Commitment to Educators</h2>
          <div className="space-y-4 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p>
                <strong>Always listening:</strong> Your feedback directly shapes our product roadmap
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p>
                <strong>Transparent pricing:</strong> No hidden fees, no surprise charges, ever
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p>
                <strong>Reliable support:</strong> Real humans ready to help when you need it
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p>
                <strong>Continuous improvement:</strong> Regular updates and new features based on your needs
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <p>
                <strong>Educational integrity:</strong> Every feature designed with pedagogy in mind
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
